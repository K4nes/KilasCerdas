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

// Slice 06: build the `joined` event payload for a given player. Used by all
// three callsites that emit `joined` (rejoin in join_room, fresh join in
// join_room, resync) so the rematch-restoration fields stay in sync.
//
// Critical: the `room` sub-object uses an explicit allowlist — we must NEVER
// spread the raw room. It carries non-serializable Node Timeout handles
// (`cleanupTimerHandle`, `rematchInvite.timeoutHandle`) plus large blobs like
// `questions`/`answers` that the client doesn't need on (re)connect.
//
// `expiresAt` is already an absolute Unix timestamp (set at invite creation
// time as `Date.now() + 10000`), so the client can compute remaining ms
// directly via `expiresAt - Date.now()` after reload.
function buildJoinedPayload(room, playerId) {
  const me = room.players.find(p => p.id === playerId);
  const opponent = room.players.find(p => p.id !== playerId);

  let rematchInvite = null;
  if (room.rematchInvite) {
    const inviter = room.players.find(p => p.id === room.rematchInvite.inviterId);
    rematchInvite = {
      inviterId: room.rematchInvite.inviterId,
      // Defensive: if inviter has been removed (shouldn't happen — disconnect
      // handler cancels the invite — but be safe), fall back to a neutral
      // label so the client modal still renders something readable.
      inviterName: inviter ? inviter.name : 'Lawan',
      expiresAt: room.rematchInvite.expiresAt,
    };
  }

  return {
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
    // Slice 06: rematch-restoration fields. All callsites must include these
    // so reload during inviting/locked/topic_select reconstructs cleanly.
    rematchInvite,
    myRematchLocked: me ? me.rematchLocked === true : false,
    opponentRematchLocked: opponent ? opponent.rematchLocked === true : false,
    lastInviterId: room.lastInviterId || null,
    lastTopic: room.topic,
    lastQuestionCount: room.questionCount,
  };
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
        // Rematch flow. null = no pending invite. Single-shot per room (FCFS).
        // Per-player `rematchLocked` (slice 04) is set symmetrically on decline
        // or timeout, and reset to false when an accept loops back into a new
        // match — see rematch_response handlers below.
        rematchInvite: null,
        // Slice 06: persists across the invite-cycle so reload-restore of a
        // locked client can derive whether *I* was the inviter or target
        // (subtitle differs). Set in `rematch_invite`, reset in
        // `rematch_response` accept branch.
        lastInviterId: null,
      };

      room.players.push({
        id: currentPlayerId,
        name: playerName || 'Host',
        socketId: socket.id,
        connected: true,
        rematchLocked: false,
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

      // Auto-cleanup. Slice 07: capture handle so `rematch_start` can reset
      // and grant each new match a fresh 30-min window.
      room.cleanupTimerHandle = setTimeout(() => {
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
        socket.emit('joined', buildJoinedPayload(room, pid));

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

      const player = { id: pid, name: playerName || 'Anonymous', socketId: socket.id, connected: true, rematchLocked: false };
      room.players.push(player);
      room.scores[pid] = 0;

      socket.join(roomId);

      socket.emit('joined', buildJoinedPayload(room, pid));

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

      socket.emit('joined', buildJoinedPayload(room, playerId));

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
      startCountdownAndPlay(roomId);
    });

    // 🔹 REMATCH INVITE — sender asks the room to rematch.
    // Slice 04: also rejects if sender is locked (defense-in-depth even though
    // client should hide the button in `locked` visual state).
    socket.on('rematch_invite', ({ roomId }) => {
      if (!rooms.has(roomId)) {
        socket.emit('error_message', { message: 'Room tidak ditemukan' });
        return;
      }
      const room = rooms.get(roomId);
      if (room.status !== 'finished') {
        socket.emit('error_message', { message: 'Rematch hanya bisa dari layar hasil' });
        return;
      }
      if (room.rematchInvite !== null) {
        socket.emit('error_message', { message: 'Sudah ada ajakan pending' });
        return;
      }
      const inviter = room.players.find(p => p.id === currentPlayerId);
      if (!inviter) {
        socket.emit('error_message', { message: 'Pemain tidak ditemukan di room' });
        return;
      }
      if (inviter.rematchLocked === true) {
        socket.emit('error_message', { message: 'Rematch sudah ditolak' });
        return;
      }

      const expiresAt = Date.now() + 10000;
      const timeoutHandle = setTimeout(() => {
        // Auto-decline on no response. Slice 04: lock BOTH players symmetrically.
        const r = rooms.get(roomId);
        if (!r || !r.rematchInvite) return;
        r.rematchInvite = null;
        for (const p of r.players) {
          p.rematchLocked = true;
        }
        io.to(roomId).emit('rematch_resolved', {
          accepted: false,
          declinerId: null,
          reason: 'timeout',
        });
      }, 10000);

      room.rematchInvite = {
        inviterId: currentPlayerId,
        expiresAt,
        timeoutHandle,
      };
      // Slice 06: persist for reload-restore of locked-state subtitle.
      // Survives decline/timeout (the locked clients need it); reset only on
      // accept (fresh cycle) inside `rematch_response`.
      room.lastInviterId = currentPlayerId;

      io.to(roomId).emit('rematch_invite_received', {
        inviterId: currentPlayerId,
        inviterName: inviter.name,
        expiresAt,
      });
    });

    // 🔹 REMATCH RESPONSE — target accepts or declines pending invite.
    socket.on('rematch_response', ({ roomId, accept }) => {
      if (!rooms.has(roomId)) {
        socket.emit('error_message', { message: 'Room tidak ditemukan' });
        return;
      }
      const room = rooms.get(roomId);
      if (!room.rematchInvite) {
        socket.emit('error_message', { message: 'Tidak ada ajakan rematch aktif' });
        return;
      }
      if (room.rematchInvite.inviterId === currentPlayerId) {
        socket.emit('error_message', { message: 'Pengirim tidak boleh merespons sendiri' });
        return;
      }

      clearTimeout(room.rematchInvite.timeoutHandle);

      if (accept) {
        // Reset state for a new match. Status moves to topic_select; host will
        // generate questions and emit `rematch_start` next.
        // Slice 04: reset rematchLocked for ALL players BEFORE other state reset
        // so the loop-back-to-idle case (after a successful accept) clears the
        // lock for the next round of decline/timeout semantics.
        for (const p of room.players) {
          p.rematchLocked = false;
        }
        room.rematchInvite = null;
        // Slice 06: clear persisted role marker so a future
        // decline-after-accept-loop doesn't leak the previous cycle's role
        // into reload-restore.
        room.lastInviterId = null;
        room.questions = [];
        room.currentQuestion = 0;
        room.answers = {};
        room.timerStartedAt = null;
        room.finishedAt = null;
        room.scores = {};
        for (const p of room.players) room.scores[p.id] = 0;
        room.status = 'topic_select';

        io.to(roomId).emit('rematch_resolved', {
          accepted: true,
          declinerId: null,
          reason: 'accepted',
        });
        io.to(roomId).emit('room_state_changed', {
          status: 'topic_select',
          hostId: room.hostId,
          lastTopic: room.topic,
          lastQuestionCount: room.questionCount,
        });
      } else {
        // Decline. Slice 04: lock BOTH players symmetrically (single-shot per
        // room). The decliner is `currentPlayerId`; reason carries enough info
        // for the client to pick the right toast/subtitle, no separate
        // `lockBoth` flag needed.
        room.rematchInvite = null;
        for (const p of room.players) {
          p.rematchLocked = true;
        }
        io.to(roomId).emit('rematch_resolved', {
          accepted: false,
          declinerId: currentPlayerId,
          reason: 'declined',
        });
      }
    });

    // 🔹 REMATCH START — host commits topic + pre-generated questions and
    // kicks off match #N. Mirrors start_duel's countdown pattern.
    socket.on('rematch_start', ({ roomId, topic, questions, questionCount }) => {
      if (!rooms.has(roomId)) {
        socket.emit('error_message', { message: 'Room tidak ditemukan' });
        return;
      }
      const room = rooms.get(roomId);
      if (room.status !== 'topic_select') {
        socket.emit('error_message', { message: 'Room tidak dalam pemilihan topik' });
        return;
      }
      if (room.hostId !== currentPlayerId) {
        socket.emit('error_message', { message: 'Hanya host yang bisa memulai duel' });
        return;
      }
      if (!Array.isArray(questions) || questions.length === 0) {
        socket.emit('error_message', { message: 'Soal tidak valid' });
        return;
      }
      if (room.players.length !== 2 || !room.players.every(p => p.connected)) {
        socket.emit('error_message', { message: 'Kedua pemain harus terhubung' });
        return;
      }

      room.topic = topic || room.topic || 'Umum';
      room.questionCount = questionCount || questions.length;
      room.questions = questions;
      room.currentQuestion = 0;
      room.answers = {};
      room.timerStartedAt = null;
      room.finishedAt = null;
      room.scores = {};
      for (const p of room.players) room.scores[p.id] = 0;
      room.status = 'countdown';

      // Slice 07: reset cleanup timer so each new match gets a fresh 30-min
      // window. Without this, a room created at t=0 is hard-deleted at t=30min
      // regardless of how many rematches were played.
      clearTimeout(room.cleanupTimerHandle);
      room.cleanupTimerHandle = setTimeout(() => {
        rooms.delete(roomId);
      }, 30 * 60 * 1000);

      io.to(roomId).emit('duel_started', {});
      startCountdownAndPlay(roomId);
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

      // Slice 05: rematch invite cancellation. Disconnect is NOT rejection,
      // so we clear the invite + broadcast resolution but do NOT lock either
      // player. The disconnecting player is always a 2-player room participant
      // here (we found them via `room.players.find` above), so any active
      // invite necessarily involves them.
      if (room.rematchInvite !== null) {
        clearTimeout(room.rematchInvite.timeoutHandle);
        const reason = currentPlayerId === room.rematchInvite.inviterId
          ? 'inviter_disconnected'
          : 'opponent_disconnected';
        room.rematchInvite = null;
        io.to(currentRoomId).emit('rematch_resolved', {
          accepted: false,
          declinerId: null,
          reason,
        });
      }

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
        // Active game / topic_select / finished: mark disconnected but preserve state
        player.connected = false;
        player.socketId = '';
        io.to(currentRoomId).emit('player_disconnected', { playerId: currentPlayerId });

        // Auto-remove after 60s reconnect window
        setTimeout(() => {
          const r = rooms.get(currentRoomId);
          if (!r) return;
          const p = r.players.find(p => p.id === currentPlayerId);
          if (!p || p.connected) return;

          // Slice 05: in topic_select, host's role is essential and there's
          // no clean fallback for either player leaving, so tear down the
          // room and tell the survivor. Skip the player_left broadcast — the
          // room is gone, the survivor should redirect home anyway.
          if (r.status === 'topic_select') {
            const wasHost = r.hostId === currentPlayerId;
            const message = wasHost ? 'Host meninggalkan room' : 'Lawan keluar room';
            io.to(currentRoomId).emit('error_message', { message });
            rooms.delete(currentRoomId);
            return;
          }

          r.players = r.players.filter(p => p.id !== currentPlayerId);
          delete r.scores[currentPlayerId];
          io.to(currentRoomId).emit('player_left', { playerId: currentPlayerId });
          if (r.players.length === 0) rooms.delete(currentRoomId);
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
