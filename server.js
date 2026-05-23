const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { GameEngine } = require('./src/lib/game-engine');
const { GameLoop } = require('./src/lib/game-loop');
const {
  REMATCH_INVITE_EXPIRY_MS,
  ROOM_CLEANUP_MS,
  RECONNECT_GRACE_MS,
} = require('./src/lib/game-config');
const { Events } = require('./src/lib/socket-event-names');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ─── App ───────────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    if (req.url && req.url.startsWith('/socket.io')) return;
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: dev ? ['websocket', 'polling'] : ['polling'],
    allowUpgrades: dev,
    pingTimeout: dev ? 20000 : 120000,
    pingInterval: dev ? 25000 : 60000,
  });

  const engine = new GameEngine();
  const gameLoop = new GameLoop(engine, {
    broadcast: (roomId, event, payload) => io.to(roomId).emit(event, payload),
    unicast: (socketId, event, payload) => {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.emit(event, payload);
    },
  });

  // ─── Socket.io Events ────────────────────────────────────────
  io.on('connection', (socket) => {
    let currentPlayerId = '';
    let currentRoomId = '';

    // 🔹 CREATE ROOM
    socket.on(Events.CREATE_ROOM, ({ topic, questionCount, questions, playerName, chatId }) => {
      const roomId = engine.generateRoomCode();
      const pid = engine.generatePlayerId();
      currentPlayerId = pid;
      currentRoomId = roomId;

      engine.createRoom(roomId, topic, questionCount, questions, pid, chatId);
      engine.addPlayer(roomId, { id: pid, name: playerName || 'Host', socketId: socket.id });

      socket.join(roomId);
      socket.emit(Events.ROOM_CREATED, engine.buildRoomCreatedPayload(roomId, pid));

      // Auto-cleanup window for finished/abandoned rooms.
      engine.startCleanupTimer(roomId, ROOM_CLEANUP_MS, (id) => engine.deleteRoom(id));
    });

    // 🔹 JOIN ROOM
    socket.on(Events.JOIN_ROOM, ({ roomId: rawRoomId, playerName, playerId: existingPlayerId }) => {
      const roomId = String(rawRoomId || '').toUpperCase();
      const room = engine.getRoom(roomId);
      if (!room) {
        socket.emit(Events.ERROR_MESSAGE, { message: 'Room tidak ditemukan' });
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
        socket.emit(Events.JOINED, engine.buildJoinedPayload(roomId, pid));

        // Re-emit current question if duel is active
        const qPayload = engine.getCurrentQuestionPayload(roomId);
        if (qPayload) socket.emit(Events.NEW_QUESTION, qPayload);

        io.to(roomId).emit(Events.PLAYER_RECONNECTED, { players: room.players });
        return;
      }

      if (room.players.length >= 2) {
        socket.emit(Events.ERROR_MESSAGE, { message: 'Room sudah penuh' });
        return;
      }
      if (room.status !== 'waiting') {
        socket.emit(Events.ERROR_MESSAGE, { message: 'Duel sudah dimulai' });
        return;
      }

      currentPlayerId = pid;
      currentRoomId = roomId;

      engine.addPlayer(roomId, { id: pid, name: playerName || 'Anonymous', socketId: socket.id });
      socket.join(roomId);
      socket.emit(Events.JOINED, engine.buildJoinedPayload(roomId, pid));
      io.to(roomId).emit(Events.PLAYER_JOINED, { players: room.players });
    });

    // 🔹 RESYNC (when page reloads)
    socket.on(Events.RESYNC, ({ roomId, playerId }) => {
      const room = engine.getRoom(roomId);
      if (!room) {
        socket.emit(Events.ERROR_MESSAGE, { message: 'Room tidak ditemukan' });
        return;
      }
      currentPlayerId = playerId;
      currentRoomId = roomId;

      engine.reconnectPlayer(roomId, playerId, socket.id);
      socket.join(roomId);
      socket.emit(Events.JOINED, engine.buildJoinedPayload(roomId, playerId));

      const qPayload = engine.getCurrentQuestionPayload(roomId);
      if (qPayload) socket.emit(Events.NEW_QUESTION, qPayload);

      io.to(roomId).emit(Events.PLAYER_RECONNECTED, { players: room.players });
    });

    // 🔹 START DUEL
    socket.on(Events.START_DUEL, ({ roomId }) => {
      const room = engine.getRoom(roomId);
      if (!room || room.hostId !== currentPlayerId) return;
      if (room.players.length !== 2) return;
      if (room.status !== 'waiting') return;

      engine.startDuel(roomId);
      io.to(roomId).emit(Events.DUEL_STARTED, {});
      gameLoop.startCountdown(roomId);
    });

    // 🔹 REMATCH INVITE
    socket.on(Events.REMATCH_INVITE, ({ roomId }) => {
      const room = engine.getRoom(roomId);
      if (!room) { socket.emit(Events.ERROR_MESSAGE, { message: 'Room tidak ditemukan' }); return; }
      if (room.status !== 'finished') { socket.emit(Events.ERROR_MESSAGE, { message: 'Rematch hanya bisa dari layar hasil' }); return; }

      const invite = engine.createRematchInvite(roomId, currentPlayerId, REMATCH_INVITE_EXPIRY_MS, (id) => {
        io.to(id).emit(Events.REMATCH_RESOLVED, {
          accepted: false,
          declinerId: null,
          reason: 'timeout',
        });
      });

      if (!invite) {
        if (room.rematchInvite) {
          socket.emit(Events.ERROR_MESSAGE, { message: 'Sudah ada ajakan pending' });
        } else {
          socket.emit(Events.ERROR_MESSAGE, { message: 'Rematch sudah ditolak' });
        }
        return;
      }

      const inviter = room.players.find(p => p.id === currentPlayerId);
      io.to(roomId).emit(Events.REMATCH_INVITE_RECEIVED, {
        inviterId: currentPlayerId,
        inviterName: inviter ? inviter.name : 'Lawan',
        expiresAt: invite.expiresAt,
      });
    });

    // 🔹 REMATCH RESPONSE
    socket.on(Events.REMATCH_RESPONSE, ({ roomId, accept }) => {
      const room = engine.getRoom(roomId);
      if (!room) { socket.emit(Events.ERROR_MESSAGE, { message: 'Room tidak ditemukan' }); return; }

      const result = engine.respondToRematch(roomId, currentPlayerId, accept);
      if (!result) {
        if (!room.rematchInvite) socket.emit(Events.ERROR_MESSAGE, { message: 'Tidak ada ajakan rematch aktif' });
        else socket.emit(Events.ERROR_MESSAGE, { message: 'Pengirim tidak boleh merespons sendiri' });
        return;
      }

      if (result.accepted) {
        io.to(roomId).emit(Events.REMATCH_RESOLVED, result);
        io.to(roomId).emit(Events.ROOM_STATE_CHANGED, {
          status: 'topic_select',
          hostId: room.hostId,
          lastTopic: room.topic,
          lastQuestionCount: room.questionCount,
        });
      } else {
        io.to(roomId).emit(Events.REMATCH_RESOLVED, result);
      }
    });

    // 🔹 REMATCH START
    socket.on(Events.REMATCH_START, ({ roomId, topic, questions, questionCount }) => {
      const room = engine.getRoom(roomId);
      if (!room) { socket.emit(Events.ERROR_MESSAGE, { message: 'Room tidak ditemukan' }); return; }
      if (room.status !== 'topic_select') { socket.emit(Events.ERROR_MESSAGE, { message: 'Room tidak dalam pemilihan topik' }); return; }
      if (room.hostId !== currentPlayerId) { socket.emit(Events.ERROR_MESSAGE, { message: 'Hanya host yang bisa memulai duel' }); return; }
      if (!Array.isArray(questions) || questions.length === 0) { socket.emit(Events.ERROR_MESSAGE, { message: 'Soal tidak valid' }); return; }
      if (room.players.length !== 2 || !room.players.every(p => p.connected)) { socket.emit(Events.ERROR_MESSAGE, { message: 'Kedua pemain harus terhubung' }); return; }

      engine.startRematch(roomId, topic, questions, questionCount);

      // Fresh cleanup window for each rematch
      engine.startCleanupTimer(roomId, ROOM_CLEANUP_MS, (id) => engine.deleteRoom(id));

      io.to(roomId).emit(Events.DUEL_STARTED, {});
      gameLoop.startCountdown(roomId);
    });

    // 🔹 SUBMIT ANSWER
    socket.on(Events.SUBMIT_ANSWER, ({ roomId, answer, playerId }) => {
      const pid = playerId || currentPlayerId;
      const result = engine.submitAnswer(roomId, pid, answer);
      if (!result) return;

      gameLoop.handleAnswer(roomId);
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
        io.to(currentRoomId).emit(Events.REMATCH_RESOLVED, {
          accepted: false,
          declinerId: null,
          reason,
        });
      }

      if (room.status === 'waiting') {
        engine.removePlayer(currentRoomId, currentPlayerId);
        const updatedRoom = engine.getRoom(currentRoomId);
        if (updatedRoom) {
          io.to(currentRoomId).emit(Events.PLAYER_LEFT, { playerId: currentPlayerId });
        }
      } else {
        engine.markDisconnected(currentRoomId, currentPlayerId);
        io.to(currentRoomId).emit(Events.PLAYER_DISCONNECTED, { playerId: currentPlayerId });

        // Reconnect grace window
        setTimeout(() => {
          const r = engine.getRoom(currentRoomId);
          if (!r) return;
          const p = r.players.find(p => p.id === currentPlayerId);
          if (!p || p.connected) return;

          if (r.status === 'topic_select') {
            const wasHost = r.hostId === currentPlayerId;
            const message = wasHost ? 'Host meninggalkan room' : 'Lawan keluar room';
            io.to(currentRoomId).emit(Events.ERROR_MESSAGE, { message });
            engine.deleteRoom(currentRoomId);
            return;
          }

          engine.removePlayer(currentRoomId, currentPlayerId);
          const updatedRoom = engine.getRoom(currentRoomId);
          if (updatedRoom) {
            io.to(currentRoomId).emit(Events.PLAYER_LEFT, { playerId: currentPlayerId });
          } else {
            engine.deleteRoom(currentRoomId);
          }
        }, RECONNECT_GRACE_MS);
      }
    });
  });

  // ─── Start ───────────────────────────────────────────────────
  httpServer.listen(port, hostname, () => {
    console.log(`> BrainClash running on http://localhost:${port}`);
  });
});
