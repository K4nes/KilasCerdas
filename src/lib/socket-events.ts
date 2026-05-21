import type { Player, RoomStatus, RematchInvite } from './types';

export const Events = {

  /* ── Client → Server ── */
  CREATE_ROOM:           'create_room',
  JOIN_ROOM:             'join_room',
  RESYNC:                'resync',
  START_DUEL:            'start_duel',
  REMATCH_INVITE:        'rematch_invite',
  REMATCH_RESPONSE:      'rematch_response',
  REMATCH_START:         'rematch_start',
  SUBMIT_ANSWER:         'submit_answer',

  /* ── Server → Client ── */
  ROOM_CREATED:          'room_created',
  JOINED:                'joined',
  PLAYER_JOINED:         'player_joined',
  PLAYER_LEFT:           'player_left',
  PLAYER_DISCONNECTED:   'player_disconnected',
  PLAYER_RECONNECTED:    'player_reconnected',
  ERROR_MESSAGE:         'error_message',
  DUEL_STARTED:          'duel_started',
  COUNTDOWN:             'countdown',
  NEW_QUESTION:          'new_question',
  ANSWER_RESULT:         'answer_result',
  SCORE_UPDATE:          'score_update',
  DUEL_END:              'duel_end',
  REMATCH_INVITE_RECEIVED: 'rematch_invite_received',
  REMATCH_RESOLVED:      'rematch_resolved',
  ROOM_STATE_CHANGED:    'room_state_changed',
} as const;

export interface ClientToServerPayloads {
  [Events.CREATE_ROOM]:      { topic: string; questionCount: number; questions: any[]; playerName: string };
  [Events.JOIN_ROOM]:        { roomId: string; playerName: string; playerId: string };
  [Events.RESYNC]:           { roomId: string; playerId: string };
  [Events.START_DUEL]:       { roomId: string };
  [Events.REMATCH_INVITE]:   { roomId: string };
  [Events.REMATCH_RESPONSE]: { roomId: string; accept: boolean };
  [Events.REMATCH_START]:    { roomId: string; topic: string; questions: any[]; questionCount: number };
  [Events.SUBMIT_ANSWER]:    { roomId: string; answer: number; playerId: string };
}

export interface JoinedPayload {
  playerId: string;
  isHost: boolean;
  players: Player[];
  room: {
    id: string;
    topic: string;
    questionCount: number;
    status: RoomStatus;
    currentQuestion: number;
    hostId: string;
  };
  scores: Record<string, number>;
  rematchInvite: RematchInvite | null;
  myRematchLocked: boolean;
  opponentRematchLocked: boolean;
  lastInviterId: string | null;
  lastTopic: string;
  lastQuestionCount: number;
}

export interface RoomCreatedPayload {
  roomId: string;
  playerId: string;
  isHost: boolean;
  players: Player[];
  room: JoinedPayload['room'];
}

export interface RematchInviteReceived {
  inviterId: string;
  inviterName: string;
  expiresAt: number;
}

export interface RematchResolved {
  accepted: boolean;
  declinerId: string | null;
  reason: 'accepted' | 'declined' | 'timeout' | 'inviter_disconnected' | 'opponent_disconnected';
}

export interface RoomStateChanged {
  status: RoomStatus;
  hostId: string;
  lastTopic: string;
  lastQuestionCount: number;
}

export interface DuelEndPayload {
  winner: { name: string; id: string } | null;
  scores: Record<string, number>;
  stats: { name: string; score: number; isWinner: boolean }[];
  topic: string;
}

export interface ScoreUpdatePayload {
  scores: Record<string, number>;
}

export interface AnswerResultPayload {
  correct: boolean;
  correctAnswer: number;
  scores: Record<string, number>;
}

export interface NewQuestionPayload {
  index: number;
  question: string;
  options: string[];
  timeLimit: number;
  totalQuestions: number;
}

export interface CountdownPayload {
  count: number;
}

export interface ErrorPayload {
  message: string;
}

export interface PlayersPayload {
  players: Player[];
}

export interface PlayerIdPayload {
  playerId: string;
}

export interface ServerToClientPayloads {
  [Events.ROOM_CREATED]:          RoomCreatedPayload;
  [Events.JOINED]:                JoinedPayload;
  [Events.PLAYER_JOINED]:         PlayersPayload;
  [Events.PLAYER_LEFT]:           PlayerIdPayload;
  [Events.PLAYER_DISCONNECTED]:   PlayerIdPayload;
  [Events.PLAYER_RECONNECTED]:    PlayersPayload;
  [Events.ERROR_MESSAGE]:         ErrorPayload;
  [Events.DUEL_STARTED]:          Record<string, never>;
  [Events.COUNTDOWN]:             CountdownPayload;
  [Events.NEW_QUESTION]:          NewQuestionPayload;
  [Events.ANSWER_RESULT]:         AnswerResultPayload;
  [Events.SCORE_UPDATE]:          ScoreUpdatePayload;
  [Events.DUEL_END]:              DuelEndPayload;
  [Events.REMATCH_INVITE_RECEIVED]: RematchInviteReceived;
  [Events.REMATCH_RESOLVED]:      RematchResolved;
  [Events.ROOM_STATE_CHANGED]:    RoomStateChanged;
}
