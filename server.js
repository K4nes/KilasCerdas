const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { GameEngine } = require('./src/lib/game-engine');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const QUESTION_TIME_LIMIT_MS = 10000;

// ─── App ───────────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const engine = new GameEngine();

  // ─── Socket.io Events ────────────────────────────────────────
  io.on('connection', (socket) => {
    let currentPlayerId = '';
    let currentRoomId = '';

    // 🔹 CREATE ROOM
    socket.on('create_room', ({ topic, questionCount, questions, playerName }) => {
      const roomId = engine.generateRoomCode();
      const pid = engine.generatePlayerId();
      currentPlayerId = pid;
      currentRoomId = roomId;

      engine.createRoom(roomId, topic, questionCount, questions, pid);
      engine.addPlayer(roomId, { id: pid, name: playerName || 'Host', socketId: socket.id });

      socket.join(roomId);
      socket.emit('room_created', engine.buildRoomCreatedPayload(roomId, pid));

      // 30-min auto-cleanup
      engine.startCleanupTimer(roomId, 30 * 60 * 1000, (id) => engine.deleteRoom(id));
    });

    // 🔹 JOIN ROOM
    socket.on('join_room', ({ roomId: rawRoomId, playerName, playerId: existingPlayerId }) => {
      const roomId = String(rawRoomId || '').toUpperCase();
      const room = engine.getRoom(roomId);
      if (!room) {
        socket.emit('error_message', { message: 'Room tidak ditemukan' });
        return;
      }

      const pid = existingPlayerId || engine.generatePlayerId();

      // Rejoin / resync path
      const existingPlayer = room.players.find(p => p.id === pid);
      if (existingPlayer) {
        currentPlayerId = pid;
        currentRoomId = roomId;
        engine.reconnectPlayer(roomId, pid, socket.id);
        socket.join(roomId);
        socket.emit('joined', engine.buildJoinedPayload(roomId, pid));

        // Re-emit current question if duel is active
        const qPayload = engine.getCurrentQuestionPayload(roomId);
        if (qPayload) socket.emit('new_question', qPayload);

        io.to(roomId).emit('player_reconnected', { players: room.players });
        return;
      }

      if (room.players.length >= 2) {
        socket.emit('error_message', { message: 'Room sudah penuh' });
        return;
      }
      if (room.status !== 'waiting') {
        socket.emit('error_message', { message: 'Duel sudah dimulai' });
        return;
      }

      currentPlayerId = pid;
      currentRoomId = roomId;

      engine.addPlayer(roomId, { id: pid, name: playerName || 'Anonymous', socketId: socket.id });
      socket.join(roomId);
      socket.emit('joined', engine.buildJoinedPayload(roomId, pid));
      io.to(roomId).emit('player_joined', { players: room.players });
    });

    // 🔹 RESYNC (when page reloads)
    socket.on('resync', ({ roomId, playerId }) => {
      const room = engine.getRoom(roomId);
      if (!room) {
        socket.emit('error_message', { message: 'Room tidak ditemukan' });
        return;
      }
      currentPlayerId = playerId;
      currentRoomId = roomId;

      engine.reconnectPlayer(roomId, playerId, socket.id);
      socket.join(roomId);
      socket.emit('joined', engine.buildJoinedPayload(roomId, playerId));

      const qPayload = engine.getCurrentQuestionPayload(roomId);
      if (qPayload) socket.emit('new_question', qPayload);

      io.to(roomId).emit('player_reconnected', { players: room.players });
    });

    // 🔹 START DUEL
    socket.on('start_duel', ({ roomId }) => {
      const room = engine.getRoom(roomId);
      if (!room || room.hostId !== currentPlayerId) return;
      if (room.players.length !== 2) return;
      if (room.status !== 'waiting') return;

      engine.startDuel(roomId);
      io.to(roomId).emit('duel_started', {});
      startCountdownAndPlay(roomId);
    });

    // 🔹 REMATCH INVITE
    socket.on('rematch_invite', ({ roomId }) => {
      const room = engine.getRoom(roomId);
      if (!room) { socket.emit('error_message', { message: 'Room tidak ditemukan' }); return; }
      if (room.status !== 'finished') { socket.emit('error_message', { message: 'Rematch hanya bisa dari layar hasil' }); return; }

      const invite = engine.createRematchInvite(roomId, currentPlayerId, 10000, (id) => {
        io.to(id).emit('rematch_resolved', {
          accepted: false,
          declinerId: null,
          reason: 'timeout',
        });
      });

      if (!invite) {
        if (room.rematchInvite) {
          socket.emit('error_message', { message: 'Sudah ada ajakan pending' });
        } else {
          socket.emit('error_message', { message: 'Rematch sudah ditolak' });
        }
        return;
      }

      const inviter = room.players.find(p => p.id === currentPlayerId);
      io.to(roomId).emit('rematch_invite_received', {
        inviterId: currentPlayerId,
        inviterName: inviter ? inviter.name : 'Lawan',
        expiresAt: invite.expiresAt,
      });
    });

    // 🔹 REMATCH RESPONSE
    socket.on('rematch_response', ({ roomId, accept }) => {
      const room = engine.getRoom(roomId);
      if (!room) { socket.emit('error_message', { message: 'Room tidak ditemukan' }); return; }

      const result = engine.respondToRematch(roomId, currentPlayerId, accept);
      if (!result) {
        if (!room.rematchInvite) socket.emit('error_message', { message: 'Tidak ada ajakan rematch aktif' });
        else socket.emit('error_message', { message: 'Pengirim tidak boleh merespons sendiri' });
        return;
      }

      if (result.accepted) {
        io.to(roomId).emit('rematch_resolved', result);
        io.to(roomId).emit('room_state_changed', {
          status: 'topic_select',
          hostId: room.hostId,
          lastTopic: room.topic,
          lastQuestionCount: room.questionCount,
        });
      } else {
        io.to(roomId).emit('rematch_resolved', result);
      }
    });

    // 🔹 REMATCH START
    socket.on('rematch_start', ({ roomId, topic, questions, questionCount }) => {
      const room = engine.getRoom(roomId);
      if (!room) { socket.emit('error_message', { message: 'Room tidak ditemukan' }); return; }
      if (room.status !== 'topic_select') { socket.emit('error_message', { message: 'Room tidak dalam pemilihan topik' }); return; }
      if (room.hostId !== currentPlayerId) { socket.emit('error_message', { message: 'Hanya host yang bisa memulai duel' }); return; }
      if (!Array.isArray(questions) || questions.length === 0) { socket.emit('error_message', { message: 'Soal tidak valid' }); return; }
      if (room.players.length !== 2 || !room.players.every(p => p.connected)) { socket.emit('error_message', { message: 'Kedua pemain harus terhubung' }); return; }

      engine.startRematch(roomId, topic, questions, questionCount);

      // Fresh 30-min cleanup window for each rematch
      engine.startCleanupTimer(roomId, 30 * 60 * 1000, (id) => engine.deleteRoom(id));

      io.to(roomId).emit('duel_started', {});
      startCountdownAndPlay(roomId);
    });

    // 🔹 SUBMIT ANSWER
    socket.on('submit_answer', ({ roomId, answer, playerId }) => {
      const pid = playerId || currentPlayerId;
      const result = engine.submitAnswer(roomId, pid, answer);
      if (!result) return;

      checkBothAnswers(roomId);
    });

    // 🔹 DISCONNECT
    socket.on('disconnect', () => {
      if (!currentRoomId) return;
      const room = engine.getRoom(currentRoomId);
      if (!room) return;

      const player = room.players.find(p => p.id === currentPlayerId);
      if (!player) return;

      // Cancel rematch invite on disconnect
      if (room.rematchInvite) {
        const reason = currentPlayerId === room.rematchInvite.inviterId
          ? 'inviter_disconnected'
          : 'opponent_disconnected';
        engine.cancelRematchInvite(currentRoomId);
        io.to(currentRoomId).emit('rematch_resolved', {
          accepted: false,
          declinerId: null,
          reason,
        });
      }

      if (room.status === 'waiting') {
        engine.removePlayer(currentRoomId, currentPlayerId);
        const updatedRoom = engine.getRoom(currentRoomId);
        if (updatedRoom) {
          io.to(currentRoomId).emit('player_left', { playerId: currentPlayerId });
        }
      } else {
        engine.markDisconnected(currentRoomId, currentPlayerId);
        io.to(currentRoomId).emit('player_disconnected', { playerId: currentPlayerId });

        // 60s reconnect window
        setTimeout(() => {
          const r = engine.getRoom(currentRoomId);
          if (!r) return;
          const p = r.players.find(p => p.id === currentPlayerId);
          if (!p || p.connected) return;

          if (r.status === 'topic_select') {
            const wasHost = r.hostId === currentPlayerId;
            const message = wasHost ? 'Host meninggalkan room' : 'Lawan keluar room';
            io.to(currentRoomId).emit('error_message', { message });
            engine.deleteRoom(currentRoomId);
            return;
          }

          engine.removePlayer(currentRoomId, currentPlayerId);
          const updatedRoom = engine.getRoom(currentRoomId);
          if (updatedRoom) {
            io.to(currentRoomId).emit('player_left', { playerId: currentPlayerId });
          } else {
            engine.deleteRoom(currentRoomId);
          }
        }, 60000);
      }
    });
  });

  // ─── Helpers ─────────────────────────────────────────────────
  function startCountdownAndPlay(roomId) {
    let count = 3;
    const ci = setInterval(() => {
      io.to(roomId).emit('countdown', { count });
      count--;
      if (count < 0) {
        clearInterval(ci);
        beginQuestion(roomId);
      }
    }, 1000);
  }

  let questionTimer = null;

  function beginQuestion(roomId) {
    const room = engine.getRoom(roomId);
    if (!room) return;

    engine.beginQuestion(roomId);

    const qPayload = engine.getCurrentQuestionPayload(roomId);
    if (qPayload) io.to(roomId).emit('new_question', qPayload);

    questionTimer = setTimeout(() => forceTimeout(roomId), QUESTION_TIME_LIMIT_MS);
  }

  function forceTimeout(roomId) {
    const room = engine.getRoom(roomId);
    if (!room || room.status !== 'playing') return;

    const unanswered = engine.getUnansweredPlayerIds(roomId);
    for (const pid of unanswered) {
      engine.submitAnswer(roomId, pid, null);
    }
    revealAnswersAndAdvance(roomId);
  }

  function revealAnswersAndAdvance(roomId) {
    const room = engine.getRoom(roomId);
    if (!room) return;

    const question = room.questions[room.currentQuestion];

    // Send answer_result to each player
    for (const player of room.players) {
      const answerIndex = room.answers[player.id];
      const isCorrect = answerIndex === question.correctIndex;
      const socketInstance = io.sockets.sockets.get(player.socketId);
      if (socketInstance) {
        socketInstance.emit('answer_result', {
          correct: isCorrect,
          correctAnswer: question.correctIndex,
          scores: { ...room.scores },
        });
      }
    }

    // Emit score update to the room
    io.to(roomId).emit('score_update', { scores: { ...room.scores } });

    // Wait 2 seconds (so both can see the feedback), then advance the question
    setTimeout(() => {
      advanceOrEnd(roomId);
    }, 2000);
  }

  function checkBothAnswers(roomId) {
    if (!engine.areAllAnswered(roomId)) return;
    clearTimeout(questionTimer);
    revealAnswersAndAdvance(roomId);
  }

  function advanceOrEnd(roomId) {
    const result = engine.advanceQuestion(roomId);
    if (!result) return;

    if (result.isOver) {
      // 1.5s delay before showing results
      setTimeout(() => {
        const room = engine.getRoom(roomId);
        if (!room) return;
        io.to(roomId).emit('duel_end', {
          winner: result.winner,
          scores: result.scores,
          stats: result.stats,
          topic: result.topic,
        });
      }, 1500);
    } else {
      // 2s delay before next question
      setTimeout(() => {
        const room = engine.getRoom(roomId);
        if (!room) return;
        engine.beginQuestion(roomId);

        const qPayload = engine.getCurrentQuestionPayload(roomId);
        if (qPayload) io.to(roomId).emit('new_question', qPayload);

        questionTimer = setTimeout(() => forceTimeout(roomId), QUESTION_TIME_LIMIT_MS);
      }, 2000);
    }
  }

  // ─── Start ───────────────────────────────────────────────────
  httpServer.listen(port, hostname, () => {
    console.log(`> BrainClash running on http://localhost:${port}`);
  });
});
