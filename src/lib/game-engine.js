/**
 * GameEngine — centralized game logic for BrainClash.
 *
 * Manages room lifecycle, player state, duel progression, scoring,
 * rematch flow, and cleanup timers. Pure state management — no
 * Socket.io references, no socket emits. The caller (server.js)
 * is responsible for wiring events and broadcasting.
 *
 * Usage:
 *   const { GameEngine } = require('./src/lib/game-engine');
 *   const engine = new GameEngine();
 */
const { resolveWinner } = require('./resolve-winner');
const { QUESTION_TIME_LIMIT_MS } = require('./game-config');

class GameEngine {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  // ─── Helpers ────────────────────────────────────────────────

  generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  generatePlayerId() {
    return 'player_' + Math.random().toString(36).substring(2, 10);
  }

  calculateScore(isCorrect, timeTakenMs, timeLimitMs) {
    if (!isCorrect) return 0;
    const base = 100;
    const timeRatio = Math.max(0, 1 - timeTakenMs / timeLimitMs);
    const speedBonus = Math.round(timeRatio * 100);
    return base + speedBonus;
  }

  // ─── Room lifecycle ──────────────────────────────────────────

  /** @param {string} id @param {string} topic @param {number} questionCount @param {Array} questions @param {string} hostId @param {string} [chatId] @returns {Room} */
  createRoom(id, topic, questionCount, questions, hostId, chatId) {
    const room = {
      id,
      topic: topic || 'Umum',
      questionCount: questionCount || 5,
      questions: questions || [],
      players: [],
      scores: {},
      status: 'waiting',
      currentQuestion: 0,
      hostId,
      timerStartedAt: null,
      answers: {},
      createdAt: Date.now(),
      finishedAt: null,
      rematchInvite: null,
      lastInviterId: null,
      cleanupTimerHandle: null,
      chatId: chatId || null,
    };
    this.rooms.set(id, room);
    return room;
  }

  /** @param {string} id @returns {Room|undefined} */
  getRoom(id) {
    return this.rooms.get(id);
  }

  /** @param {string} id */
  deleteRoom(id) {
    const room = this.rooms.get(id);
    if (room && room.cleanupTimerHandle) {
      clearTimeout(room.cleanupTimerHandle);
    }
    this.rooms.delete(id);
  }

  /**
   * Start a cleanup timer for a room. Clears any existing timer first.
   * @param {string} roomId
   * @param {number} timeoutMs
   * @param {function} onExpired — called when the timer fires
   */
  startCleanupTimer(roomId, timeoutMs, onExpired) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.cleanupTimerHandle) clearTimeout(room.cleanupTimerHandle);
    room.cleanupTimerHandle = setTimeout(() => {
      onExpired(roomId);
    }, timeoutMs);
  }

  /** @returns {number} */
  getActiveRoomCount() {
    return this.rooms.size;
  }

  // ─── Player lifecycle ────────────────────────────────────────

  /**
   * @param {string} roomId
   * @param {{ id: string, name: string, socketId: string }} player
   * @returns {import('./types').Player|null}
   */
  addPlayer(roomId, player) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.length >= 2) return null;
    if (room.status !== 'waiting') return null;

    const fullPlayer = { ...player, connected: true, rematchLocked: false };
    room.players.push(fullPlayer);
    room.scores[player.id] = 0;
    return fullPlayer;
  }

  /**
   * @param {string} roomId
   * @param {string} playerId
   * @returns {Room|null} — null if room was deleted (empty)
   */
  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.players = room.players.filter(p => p.id !== playerId);
    delete room.scores[playerId];

    if (room.players.length === 0) {
      this.deleteRoom(roomId);
      return null;
    }
    return room;
  }

  /**
   * Mark a player as disconnected (not removed — preserves scores).
   * @returns {Player|null}
   */
  markDisconnected(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;
    player.connected = false;
    player.socketId = '';
    return player;
  }

  /**
   * Reconnect a player (used by resync/rejoin).
   * @returns {Player|null}
   */
  reconnectPlayer(roomId, playerId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;
    player.socketId = socketId;
    player.connected = true;
    return player;
  }

  // ─── Duel lifecycle ──────────────────────────────────────────

  /**
   * Start duel (transitions to countdown state).
   * @returns {Room|null}
   */
  startDuel(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.length !== 2) return null;
    if (room.status !== 'waiting') return null;

    room.status = 'countdown';
    room.currentQuestion = 0;
    room.scores = {};
    for (const p of room.players) room.scores[p.id] = 0;
    return room;
  }

  /**
   * Begin a question (set status to playing, record timer start).
   * @returns {Room|null}
   */
  beginQuestion(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.status = 'playing';
    room.timerStartedAt = Date.now();
    room.answers = {};
    return room;
  }

  /**
   * Submit answer for a player.
   * @param {string} roomId
   * @param {string} playerId
   * @param {number|null} answerIndex
   * @returns {{ correct: boolean, correctAnswer: number, scores: Record<string,number> }|null}
   */
  submitAnswer(roomId, playerId, answerIndex) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'playing') return null;
    if (room.answers[playerId] !== undefined) return null;

    room.answers[playerId] = answerIndex;

    const question = room.questions[room.currentQuestion];
    const isCorrect = answerIndex === question.correctIndex;
    const timeTaken = room.timerStartedAt ? Date.now() - room.timerStartedAt : QUESTION_TIME_LIMIT_MS;
    const score = this.calculateScore(isCorrect, timeTaken, QUESTION_TIME_LIMIT_MS);

    if (isCorrect) {
      room.scores[playerId] = (room.scores[playerId] || 0) + score;
    }

    return {
      correct: isCorrect,
      correctAnswer: question.correctIndex,
      scores: { ...room.scores },
    };
  }

  /**
   * Returns array of player IDs whose answers are still undefined.
   * @returns {string[]}
   */
  getUnansweredPlayerIds(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.players
      .filter(p => room.answers[p.id] === undefined)
      .map(p => p.id);
  }

  /**
   * Check if all players have answered.
   * @returns {boolean}
   */
  areAllAnswered(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    return Object.keys(room.answers).length >= room.players.length;
  }

  /**
   * Advance to the next question, or end the duel.
   * @returns {{ isOver: true, winner: object|null, scores: object, stats: Array }|{ isOver: false, nextIndex: number }|null}
   */
  advanceQuestion(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const nextIndex = room.currentQuestion + 1;

    if (nextIndex >= room.questions.length) {
      room.status = 'finished';
      room.finishedAt = Date.now();

      const { winner, stats } = resolveWinner(room.scores, room.players);

      return {
        isOver: true,
        winner,
        scores: { ...room.scores },
        stats,
        topic: room.topic,
      };
    }

    room.currentQuestion = nextIndex;
    room.answers = {};
    room.timerStartedAt = null;
    return { isOver: false, nextIndex };
  }

  /**
   * Get winner info for a finished room.
   */
  getWinner(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return { winner: null, scores: {}, stats: [] };

    const { winner, stats } = resolveWinner(room.scores, room.players);
    return { winner, scores: { ...room.scores }, stats };
  }

  // ─── Rematch ─────────────────────────────────────────────────

  /**
   * Create a rematch invite.
   * @returns {import('./types').RematchInvite|null}
   */
  createRematchInvite(roomId, inviterId, timeoutMs, onTimeout) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'finished' || room.rematchInvite) return null;

    const inviter = room.players.find(p => p.id === inviterId);
    if (!inviter || inviter.rematchLocked === true) return null;

    const expiresAt = Date.now() + timeoutMs;
    const timeoutHandle = setTimeout(() => {
      this._expireRematchInvite(roomId, onTimeout);
    }, timeoutMs);

    const invite = { inviterId, inviterName: inviter.name, expiresAt, timeoutHandle };
    room.rematchInvite = invite;
    room.lastInviterId = inviterId;
    return invite;
  }

  /** @private */
  _expireRematchInvite(roomId, onTimeout) {
    const room = this.rooms.get(roomId);
    if (!room || !room.rematchInvite) return;
    room.rematchInvite = null;
    for (const p of room.players) p.rematchLocked = true;
    onTimeout(roomId);
  }

  /**
   * Cancel a rematch invite (used on disconnect).
   */
  cancelRematchInvite(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.rematchInvite) return false;
    clearTimeout(room.rematchInvite.timeoutHandle);
    room.rematchInvite = null;
    return true;
  }

  /**
   * Respond to a rematch invite.
   * @returns {{ accepted: boolean, declinerId: string|null, reason: string }|null}
   */
  respondToRematch(roomId, playerId, accept) {
    const room = this.rooms.get(roomId);
    if (!room || !room.rematchInvite) return null;
    if (room.rematchInvite.inviterId === playerId) return null;

    clearTimeout(room.rematchInvite.timeoutHandle);

    if (accept) {
      for (const p of room.players) p.rematchLocked = false;
      room.rematchInvite = null;
      room.lastInviterId = null;
      room.questions = [];
      room.currentQuestion = 0;
      room.answers = {};
      room.timerStartedAt = null;
      room.finishedAt = null;
      room.scores = {};
      for (const p of room.players) room.scores[p.id] = 0;
      room.status = 'topic_select';
      return { accepted: true, declinerId: null, reason: 'accepted' };
    }

    room.rematchInvite = null;
    for (const p of room.players) p.rematchLocked = true;
    return { accepted: false, declinerId: playerId, reason: 'declined' };
  }

  /**
   * Start a rematch (after topic selection).
   * @returns {Room|null}
   */
  startRematch(roomId, topic, questions, questionCount) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'topic_select') return null;

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
    return room;
  }

  // ─── Joined payload builder ──────────────────────────────────

  /**
   * Build the payload for the `joined` event.
   * @param {string} roomId
   * @param {string} playerId
   * @returns {object|null}
   */
  buildJoinedPayload(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const me = room.players.find(p => p.id === playerId);
    const opponent = room.players.find(p => p.id !== playerId);

    let rematchInvite = null;
    if (room.rematchInvite) {
      const inviter = room.players.find(p => p.id === room.rematchInvite.inviterId);
      rematchInvite = {
        inviterId: room.rematchInvite.inviterId,
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
        chatId: room.chatId || undefined,
      },
      scores: { ...room.scores },
      rematchInvite,
      myRematchLocked: me ? me.rematchLocked === true : false,
      opponentRematchLocked: opponent ? opponent.rematchLocked === true : false,
      lastInviterId: room.lastInviterId || null,
      lastTopic: room.topic,
      lastQuestionCount: room.questionCount,
    };
  }

  /**
   * Build the room_created payload.
   */
  buildRoomCreatedPayload(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      roomId,
      playerId,
      isHost: true,
      players: room.players,
      room: {
        id: roomId,
        topic: room.topic,
        questionCount: room.questionCount,
        status: room.status,
        hostId: playerId,
        chatId: room.chatId || undefined,
      },
    };
  }

  /**
   * Get current question info for a playing room.
   */
  getCurrentQuestionPayload(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing' || !room.questions[room.currentQuestion]) return null;
    const q = room.questions[room.currentQuestion];
    return {
      index: room.currentQuestion,
      question: q.question,
      options: q.options,
      timeLimit: 10,
      totalQuestions: room.questions.length,
      elapsedMs: room.timerStartedAt ? Date.now() - room.timerStartedAt : 0,
    };
  }
}

module.exports = { GameEngine };
