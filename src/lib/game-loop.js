const { QUESTION_TIME_LIMIT_MS } = require('./game-config');
const { Events } = require('./socket-event-names');

class GameLoop {
  constructor(engine, emitter) {
    this.engine = engine;
    this.emitter = emitter;
    this.questionTimer = null;
  }

  startCountdown(roomId) {
    let count = 3;
    const ci = setInterval(() => {
      this.emitter.broadcast(roomId, Events.COUNTDOWN, { count });
      count--;
      if (count < 0) {
        clearInterval(ci);
        this.startQuestion(roomId);
      }
    }, 1000);
  }

  startQuestion(roomId) {
    const room = this.engine.getRoom(roomId);
    if (!room) return;

    this.engine.beginQuestion(roomId);

    const qPayload = this.engine.getCurrentQuestionPayload(roomId);
    if (qPayload) this.emitter.broadcast(roomId, Events.NEW_QUESTION, qPayload);

    this._scheduleTimeout(roomId);
  }

  handleAnswer(roomId) {
    if (!this.engine.areAllAnswered(roomId)) return;
    this._clearTimeout();
    this._revealAndAdvance(roomId);
  }

  _scheduleTimeout(roomId) {
    this._clearTimeout();
    this.questionTimer = setTimeout(() => {
      this._forceTimeout(roomId);
    }, QUESTION_TIME_LIMIT_MS);
  }

  _clearTimeout() {
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = null;
    }
  }

  _forceTimeout(roomId) {
    const room = this.engine.getRoom(roomId);
    if (!room || room.status !== 'playing') return;

    const unanswered = this.engine.getUnansweredPlayerIds(roomId);
    for (const pid of unanswered) {
      this.engine.submitAnswer(roomId, pid, null);
    }
    this._revealAndAdvance(roomId);
  }

  _revealAndAdvance(roomId) {
    const room = this.engine.getRoom(roomId);
    if (!room) return;

    const question = room.questions[room.currentQuestion];

    for (const player of room.players) {
      const answerIndex = room.answers[player.id];
      const isCorrect = answerIndex === question.correctIndex;
      this.emitter.unicast(player.socketId, Events.ANSWER_RESULT, {
        correct: isCorrect,
        correctAnswer: question.correctIndex,
        scores: { ...room.scores },
      });
    }

    this.emitter.broadcast(roomId, Events.SCORE_UPDATE, { scores: { ...room.scores } });

    setTimeout(() => {
      this._advanceOrEnd(roomId);
    }, 2000);
  }

  _advanceOrEnd(roomId) {
    const result = this.engine.advanceQuestion(roomId);
    if (!result) return;

    if (result.isOver) {
      setTimeout(() => {
        const room = this.engine.getRoom(roomId);
        if (!room) return;
        this.emitter.broadcast(roomId, Events.DUEL_END, {
          winner: result.winner,
          scores: result.scores,
          stats: result.stats,
          topic: result.topic,
        });
      }, 1500);
    } else {
      setTimeout(() => {
        this.startQuestion(roomId);
      }, 2000);
    }
  }

  cleanup() {
    this._clearTimeout();
  }
}

module.exports = { GameLoop };
