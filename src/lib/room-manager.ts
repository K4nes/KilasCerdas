export interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Player {
  id: string;
  name: string;
  socketId: string;
}

export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

export interface Room {
  id: string;
  topic: string;
  questionCount: number;
  questions: Question[];
  players: Player[];
  scores: Record<string, number>;
  status: RoomStatus;
  currentQuestion: number;
  hostId: string;
  timerStartedAt: number | null;
  answers: Record<string, number | null>;
  createdAt: number;
  finishedAt: number | null;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(
    id: string,
    topic: string,
    questionCount: number,
    questions: Question[],
    hostId: string
  ): Room {
    const room: Room = {
      id,
      topic,
      questionCount,
      questions,
      players: [],
      scores: {},
      status: 'waiting',
      currentQuestion: 0,
      hostId,
      timerStartedAt: null,
      answers: {},
      createdAt: Date.now(),
      finishedAt: null,
    };
    this.rooms.set(id, room);
    this.startCleanupTimer(id);
    return room;
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  addPlayer(roomId: string, player: Player): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.length >= 2) return null;
    if (room.status !== 'waiting') return null;

    room.players.push(player);
    room.scores[player.id] = 0;
    return room;
  }

  removePlayer(roomId: string, playerId: string): Room | null {
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

  startDuel(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.length !== 2) return null;

    room.status = 'countdown';
    room.currentQuestion = 0;
    room.scores = {};
    for (const p of room.players) {
      room.scores[p.id] = 0;
    }
    return room;
  }

  startQuestion(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.status = 'playing';
    room.timerStartedAt = Date.now();
    room.answers = {};
    return room;
  }

  submitAnswer(
    roomId: string,
    playerId: string,
    answerIndex: number | null
  ): { correct: boolean; correctAnswer: number; scores: Record<string, number> } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'playing') return null;
    if (room.answers[playerId] !== undefined) return null;

    room.answers[playerId] = answerIndex;

    const question = room.questions[room.currentQuestion];
    const isCorrect = answerIndex === question.correctIndex;
    const timeTaken = room.timerStartedAt ? Date.now() - room.timerStartedAt : 10000;
    const score = this.calculateScore(isCorrect, timeTaken, 10000);

    if (isCorrect) {
      room.scores[playerId] = (room.scores[playerId] || 0) + score;
    }

    return {
      correct: isCorrect,
      correctAnswer: question.correctIndex,
      scores: { ...room.scores },
    };
  }

  advanceQuestion(roomId: string): { isOver: boolean; nextIndex: number } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const nextIndex = room.currentQuestion + 1;
    if (nextIndex >= room.questions.length) {
      room.status = 'finished';
      room.finishedAt = Date.now();
      return { isOver: true, nextIndex };
    }

    room.currentQuestion = nextIndex;
    room.answers = {};
    room.timerStartedAt = null;
    return { isOver: false, nextIndex };
  }

  getWinner(roomId: string): { winner: Player | null; scores: Record<string, number>; stats: any } {
    const room = this.rooms.get(roomId);
    if (!room) return { winner: null, scores: {}, stats: {} };

    let maxScore = -1;
    let winnerId: string | null = null;
    for (const [pid, score] of Object.entries(room.scores)) {
      if (score > maxScore) {
        maxScore = score;
        winnerId = pid;
      }
    }

    const winner = room.players.find(p => p.id === winnerId) || null;
    const stats = room.players.map(p => ({
      name: p.name,
      score: room.scores[p.id] || 0,
      isWinner: p.id === winnerId,
    }));

    return { winner, scores: { ...room.scores }, stats };
  }

  private calculateScore(isCorrect: boolean, timeTakenMs: number, timeLimitMs: number): number {
    if (!isCorrect) return 0;
    const base = 100;
    const timeRatio = Math.max(0, 1 - timeTakenMs / timeLimitMs);
    const speedBonus = Math.round(timeRatio * 100);
    return base + speedBonus;
  }

  private startCleanupTimer(roomId: string): void {
    setTimeout(() => {
      this.deleteRoom(roomId);
    }, 30 * 60 * 1000);
  }

  deleteRoom(id: string): void {
    this.rooms.delete(id);
  }

  getActiveRoomCount(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();
