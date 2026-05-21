export interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Player {
  id: string;
  name: string;
  socketId: string;
  connected?: boolean;
  rematchLocked?: boolean;
}

export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished' | 'topic_select';

export interface RematchInvite {
  inviterId: string;
  inviterName?: string;
  expiresAt: number;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

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
  rematchInvite: RematchInvite | null;
  lastInviterId: string | null;
  cleanupTimerHandle?: ReturnType<typeof setTimeout>;
}
