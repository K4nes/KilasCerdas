/**
 * Socket.io event payload types — the TS view of `socket-events.js`.
 *
 * Runtime event names (the `Events` const) live in `socket-events.js` so
 * that `server.js` (CommonJS) and the TS client share one wire
 * vocabulary. This file re-exports `Events` and adds the payload type
 * definitions used everywhere on the client.
 */

import type { Player, RoomStatus, RematchInvite, Question } from './types';

// Re-export the runtime const so callers only need to import from one place.
// The wire vocabulary lives in `socket-event-names.js` (CommonJS) so that
// server.js can require() it; this TS file adds the payload-shape types and
// re-exports the const for client callers.
import { Events as EventsRuntime } from './socket-event-names';
export { EventsRuntime as Events };

export interface ClientToServerPayloads {
  [EventsRuntime.CREATE_ROOM]:      { topic: string; questionCount: number; questions: Question[]; playerName: string };
  [EventsRuntime.JOIN_ROOM]:        { roomId: string; playerName: string; playerId: string };
  [EventsRuntime.RESYNC]:           { roomId: string; playerId: string };
  [EventsRuntime.START_DUEL]:       { roomId: string };
  [EventsRuntime.REMATCH_INVITE]:   { roomId: string };
  [EventsRuntime.REMATCH_RESPONSE]: { roomId: string; accept: boolean };
  [EventsRuntime.REMATCH_START]:    { roomId: string; topic: string; questions: Question[]; questionCount: number };
  [EventsRuntime.SUBMIT_ANSWER]:    { roomId: string; answer: number; playerId: string };
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
  elapsedMs?: number;
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
  [EventsRuntime.ROOM_CREATED]:           RoomCreatedPayload;
  [EventsRuntime.JOINED]:                 JoinedPayload;
  [EventsRuntime.PLAYER_JOINED]:          PlayersPayload;
  [EventsRuntime.PLAYER_LEFT]:            PlayerIdPayload;
  [EventsRuntime.PLAYER_DISCONNECTED]:    PlayerIdPayload;
  [EventsRuntime.PLAYER_RECONNECTED]:     PlayersPayload;
  [EventsRuntime.ERROR_MESSAGE]:          ErrorPayload;
  [EventsRuntime.DUEL_STARTED]:           Record<string, never>;
  [EventsRuntime.COUNTDOWN]:              CountdownPayload;
  [EventsRuntime.NEW_QUESTION]:           NewQuestionPayload;
  [EventsRuntime.ANSWER_RESULT]:          AnswerResultPayload;
  [EventsRuntime.SCORE_UPDATE]:           ScoreUpdatePayload;
  [EventsRuntime.DUEL_END]:               DuelEndPayload;
  [EventsRuntime.REMATCH_INVITE_RECEIVED]: RematchInviteReceived;
  [EventsRuntime.REMATCH_RESOLVED]:       RematchResolved;
  [EventsRuntime.ROOM_STATE_CHANGED]:     RoomStateChanged;
}
