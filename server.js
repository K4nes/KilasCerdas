const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ─── Room Manager ──────────────────────────────────────────────
const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calculateScore(isCorrect, timeTakenMs, timeLimitMs) {
  if (!isCorrect) return 0;
  const base = 100;
  const timeRatio = Math.max(0, 1 - timeTakenMs / timeLimitMs);
  const speedBonus = Math.round(timeRatio * 100);
  return base + speedBonus;
}

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

  // ─── Socket.io Events ────────────────────────────────────────
  io.on('connection', (socket) => {
    let currentPlayerId = '';
    let currentRoomId = '';

    // 🔹 CREATE ROOM
    socket.on('create_room', ({ topic, questionCount, questions, playerName }) => {
      const roomId = generateRoomCode();
      currentPlayerId = 'player_' + Math.random().toString(36).substring(2, 10);
      currentRoomId = roomId;

      const room = {
        id: roomId,
        topic: topic || 'Umum',
        questionCount: questionCount || 5,
        questions: questions || [],
        players: [],
        scores: {},
        status: 'waiting',
        currentQuestion: 0,
        hostId: currentPlayerId,
        timerStartedAt: null,
        answers: {},
        createdAt: Date.now(),
        finishedAt: null,
      };

      room.players.push({
        id: currentPlayerId,
        name: playerName || 'Host',
        socketId: socket.id,
        connected: true,
      });
      room.scores[currentPlayerId] = 0;
      rooms.set(roomId, room);

      socket.join(roomId);
      socket.emit('room_created', {
        roomId,
        playerId: currentPlayerId,
        isHost: true,
        players: room.players,
        room: {
          id: roomId,
          topic: room.topic,
          questionCount: room.questionCount,
          status: room.status,
          hostId: currentPlayerId,
        },
      });

      // Auto-cleanup
      setTimeout(() => {
        rooms.delete(roomId);
      }, 30 * 60 * 1000);
    });

    // 🔹 JOIN ROOM
    socket.on('join_room', ({ roomId, playerName, playerId: existingPlayerId }) => {
      roomId = String(roomId || '').toUpperCase();
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error_message', { message: 'Room tidak ditemukan' });
        return;
      }

      const pid = existingPlayerId || 'player_' + Math.random().toString(36).substring(2, 10);

      // If player already in room, just re-sync
      const existingPlayer = room.players.find(p => p.id === pid);
      if (existingPlayer) {
        currentPlayerId = pid;
        currentRoomId = roomId;
        const wasDisconnected = !existingPlayer.connected;
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        socket.join(roomId);
        socket.emit('joined', {
          playerId: pid,
          isHost: room.hostId === pid,
          players: room.players,
          room: {
            id: room.id,
            topic: room.topic,
            questionCount: room.questionCount,
            status: room.status,
            currentQuestion: room.currentQuestion,
            hostId: room.hostId,
          },
        });

        // Re-emit current question if duel is active
        if (room.status === 'playing' && room.questions[room.currentQuestion]) {
          const q = room.questions[room.currentQuestion];
          socket.emit('new_question', {
            index: room.currentQuestion,
            question: q.question,
            options: q.options,
            timeLimit: 10,
            totalQuestions: room.questions.length,
          });
        }

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

      const player = { id: pid, name: playerName || 'Anonymous', socketId: socket.id, connected: true };
      room.players.push(player);
      room.scores[pid] = 0;

      socket.join(roomId);

      socket.emit('joined', {
        playerId: pid,
        isHost: room.hostId === pid,
        players: room.players,
        room: {
          id: room.id,
          topic: room.topic,
          questionCount: room.questionCount,
          status: room.status,
          hostId: room.hostId,
        },
      });

      io.to(roomId).emit('player_joined', { players: room.players });
    });

    // 🔹 RESYNC (when page reloads)
    socket.on('resync', ({ roomId, playerId }) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error_message', { message: 'Room tidak ditemukan' });
        return;
      }
      currentPlayerId = playerId;
      currentRoomId = roomId;
      socket.join(roomId);

      const player = room.players.find(p => p.id === playerId);
      if (player) {
        const wasDisconnected = !player.connected;
        player.socketId = socket.id;
        player.connected = true;
      }

      socket.emit('joined', {
        playerId,
        isHost: room.hostId === playerId,
        players: room.players,
        room: {
          id: room.id,
          topic: room.topic,
          questionCount: room.questionCount,
          status: room.status,
          currentQuestion: room.currentQuestion,
          hostId: room.hostId,
        },
      });

      // Re-emit current question if duel is active
      if (room.status === 'playing' && room.questions[room.currentQuestion]) {
        const q = room.questions[room.currentQuestion];
        socket.emit('new_question', {
          index: room.currentQuestion,
          question: q.question,
          options: q.options,
          timeLimit: 10,
          totalQuestions: room.questions.length,
        });
      }

      io.to(roomId).emit('player_reconnected', { players: room.players });
    });

    // 🔹 START DUEL
    socket.on('start_duel', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || room.hostId !== currentPlayerId) return;
      if (room.players.length !== 2) return;
      if (room.status !== 'waiting') return;

      room.status = 'countdown';
      room.currentQuestion = 0;
      room.scores = {};
      for (const p of room.players) room.scores[p.id] = 0;

      io.to(roomId).emit('duel_started', {});

      // Countdown 3-2-1- GO
      let count = 3;
      const ci = setInterval(() => {
        io.to(roomId).emit('countdown', { count });
        count--;
        if (count < 0) {
          clearInterval(ci);
          beginQuestion(roomId);
        }
      }, 1000);
    });

    // 🔹 SUBMIT ANSWER
    socket.on('submit_answer', ({ roomId, answer, playerId }) => {
      const pid = playerId || currentPlayerId;
      const room = rooms.get(roomId);
      if (!room || room.status !== 'playing') return;
      if (room.answers[pid] !== undefined) return;

      room.answers[pid] = answer;
      const question = room.questions[room.currentQuestion];
      const isCorrect = answer === question.correctIndex;
      const timeTaken = room.timerStartedAt ? Date.now() - room.timerStartedAt : 10000;
      const score = calculateScore(isCorrect, timeTaken, 10000);

      if (isCorrect) {
        room.scores[pid] = (room.scores[pid] || 0) + score;
      }

      socket.emit('answer_result', {
        correct: isCorrect,
        correctAnswer: question.correctIndex,
        scores: { ...room.scores },
      });

      checkBothAnswers(roomId);
    });

    // 🔹 DISCONNECT
    socket.on('disconnect', () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const player = room.players.find(p => p.id === currentPlayerId);
      if (!player) return;

      if (room.status === 'waiting') {
        // Lobby: remove player entirely
        room.players = room.players.filter(p => p.id !== currentPlayerId);
        delete room.scores[currentPlayerId];
        if (room.players.length === 0) {
          rooms.delete(currentRoomId);
        } else {
          io.to(currentRoomId).emit('player_left', { playerId: currentPlayerId });
        }
      } else {
        // Active game: mark disconnected but preserve state
        player.connected = false;
        player.socketId = '';
        io.to(currentRoomId).emit('player_disconnected', { playerId: currentPlayerId });

        // Auto-remove after 60s reconnect window
        setTimeout(() => {
          const r = rooms.get(currentRoomId);
          if (!r) return;
          const p = r.players.find(p => p.id === currentPlayerId);
          if (!p || p.connected) return;
          r.players = r.players.filter(p => p.id !== currentPlayerId);
          delete r.scores[currentPlayerId];
          io.to(currentRoomId).emit('player_left', { playerId: currentPlayerId });
          if (r.players.length === 0) rooms.delete(currentRoomId);
        }, 60000);
      }
    });
  });

  // ─── Helpers ─────────────────────────────────────────────────
  function beginQuestion(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.status = 'playing';
    room.timerStartedAt = Date.now();
    room.answers = {};

    const q = room.questions[0];
    io.to(roomId).emit('new_question', {
      index: 0,
      question: q.question,
      options: q.options,
      timeLimit: 10,
      totalQuestions: room.questions.length,
    });

    // Auto-end question after 10s
    questionTimer = setTimeout(() => {
      forceTimeout(roomId);
    }, 10000);
  }

  let questionTimer = null;

  function forceTimeout(roomId) {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') return;
    // Auto-submit null for unanswered players
    for (const p of room.players) {
      if (room.answers[p.id] === undefined) {
        room.answers[p.id] = null;
        const socketId = p.socketId;
        const socketInstance = io.sockets.sockets.get(socketId);
        if (socketInstance) {
          const question = room.questions[room.currentQuestion];
          socketInstance.emit('answer_result', {
            correct: false,
            correctAnswer: question.correctIndex,
            scores: { ...room.scores },
          });
        }
      }
    }
    advanceOrEnd(roomId);
  }

  function checkBothAnswers(roomId) {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    const answeredCount = Object.keys(room.answers).length;
    if (answeredCount < room.players.length) return;

    clearTimeout(questionTimer);
    advanceOrEnd(roomId);
  }

  function advanceOrEnd(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const nextIndex = room.currentQuestion + 1;

    if (nextIndex >= room.questions.length) {
      // DUEL END
      room.status = 'finished';
      room.finishedAt = Date.now();

      let winnerId = null;
      let maxScore = -1;
      for (const [pid, sc] of Object.entries(room.scores)) {
        if (sc > maxScore) { maxScore = sc; winnerId = pid; }
      }

      const winner = room.players.find(p => p.id === winnerId) || null;
      const stats = room.players.map(p => ({
        name: p.name,
        score: room.scores[p.id] || 0,
        isWinner: p.id === winnerId,
      }));

      setTimeout(() => {
        io.to(roomId).emit('duel_end', {
          winner: winner ? { name: winner.name, id: winner.id } : null,
          scores: { ...room.scores },
          stats,
          topic: room.topic,
        });
      }, 1500);
    } else {
      // NEXT QUESTION
      setTimeout(() => {
        room.currentQuestion = nextIndex;
        room.answers = {};
        room.timerStartedAt = Date.now();

        const q = room.questions[nextIndex];
        io.to(roomId).emit('new_question', {
          index: nextIndex,
          question: q.question,
          options: q.options,
          timeLimit: 10,
          totalQuestions: room.questions.length,
        });

        questionTimer = setTimeout(() => {
          forceTimeout(roomId);
        }, 10000);
      }, 2000);
    }
  }

  // ─── Start ───────────────────────────────────────────────────
  httpServer.listen(port, hostname, () => {
    console.log(`> BrainClash running on http://localhost:${port}`);
  });
});
