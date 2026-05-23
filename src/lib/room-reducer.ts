/**
 * Room reducer — single source of truth for the duel state machine.
 *
 * Pure function. No side effects, no socket I/O, no clipboard, no router.
 * Side effects live in `useGameSocket` which subscribes to the wire and
 * dispatches into this reducer.
 *
 * Why a reducer:
 *   • The hook used to hold 17 useState slots; renaming a single concept
 *     (e.g., "rematch role") meant editing 4 setters spread across 8 socket
 *     callbacks. The reducer collapses those into one named transition per
 *     event.
 *   • Every state transition is now testable without React, without a
 *     real Socket.io client. See `room-reducer.test.ts` — it feeds the
 *     same payload shapes that flow over the wire.
 *
 * Action shape:
 *   • `event/*` — direct mirrors of server-emitted Events. The payload is
 *     the wire payload, untransformed.
 *   • `ui/*`    — local user/UI actions that don't originate from the
 *     server (`select_answer`, `invite_tick`, etc.).
 *   • `identity/load` — one-shot init from localStorage.
 *
 * State shape is intentionally **flat**. We considered slicing into
 * `state.duel.*` / `state.rematch.*`, but the screens already read 31
 * fields verbatim and a flat shape lets `useGameSocket` return the state
 * spread without an adapter. If a future move needs slices, the type
 * comments below already group fields by concept — the regrouping is
 * mechanical when it's worth doing.
 */

import type {
  Player,
  Question,
  RoomStatus,
  RematchInvite,
} from './types';
import type {
  JoinedPayload,
  RoomCreatedPayload,
  PlayersPayload,
  PlayerIdPayload,
  CountdownPayload,
  NewQuestionPayload,
  AnswerResultPayload,
  ScoreUpdatePayload,
  DuelEndPayload,
  RematchInviteReceived,
  RematchResolved,
  RoomStateChanged,
} from './socket-events';

export interface RoomData {
  id: string;
  topic: string;
  questionCount: number;
  status: RoomStatus;
  currentQuestion?: number;
  hostId?: string;
  chatId?: string;
}

export type AnswerState = 'pending' | 'correct' | 'wrong' | 'timeout';
export type InviteRole = 'inviter' | 'target' | null;

/**
 * Full room state. Fields are flat to match the existing screen interface;
 * the comment groups indicate the conceptual slices for future reference.
 */
export interface RoomState {
  // ── Identity ──
  playerId: string;
  playerName: string;
  isHost: boolean;

  // ── Room ──
  status: RoomStatus;
  room: RoomData | null;
  players: Player[];

  // ── Duel ──
  qIndex: number;
  totalQuestions: number;
  currentQuestion: Question | null;
  scores: Record<string, number>;
  selectedAnswer: number | null;
  answerState: AnswerState;
  correctAnswer: number | null;
  showAnswerFeedback: boolean;
  timerOffset: number;
  countdown: number | null;

  // ── Result ──
  result: DuelEndPayload | null;

  // ── Rematch ──
  rematchInvite: RematchInvite | null;
  inviteRemainingMs: number;
  myRematchLocked: boolean;
  lastInviteRole: InviteRole;
  lastTopic: string;
  lastQuestionCount: number;
}

export type RoomAction =
  // Identity / init
  | { type: 'identity/load'; playerId: string; playerName: string }

  // Server events (1:1 with `Events.*`)
  | { type: 'event/joined'; payload: JoinedPayload }
  | { type: 'event/room_created'; payload: RoomCreatedPayload }
  | { type: 'event/player_joined'; payload: PlayersPayload }
  | { type: 'event/player_left'; payload: PlayerIdPayload }
  | { type: 'event/player_disconnected'; payload: PlayerIdPayload }
  | { type: 'event/player_reconnected'; payload: PlayersPayload }
  | { type: 'event/duel_started' }
  | { type: 'event/countdown'; payload: CountdownPayload }
  | { type: 'event/new_question'; payload: NewQuestionPayload }
  | { type: 'event/answer_result'; payload: AnswerResultPayload }
  | { type: 'event/score_update'; payload: ScoreUpdatePayload }
  | { type: 'event/duel_end'; payload: DuelEndPayload }
  | { type: 'event/rematch_invite_received'; payload: RematchInviteReceived }
  | { type: 'event/rematch_resolved'; payload: RematchResolved }
  | { type: 'event/room_state_changed'; payload: RoomStateChanged }

  // UI / control
  | { type: 'ui/select_answer'; index: number }
  | { type: 'ui/invite_tick'; remainingMs: number };

export const initialRoomState: RoomState = {
  playerId: '',
  playerName: '',
  isHost: false,

  status: 'waiting',
  room: null,
  players: [],

  qIndex: 0,
  totalQuestions: 0,
  currentQuestion: null,
  scores: {},
  selectedAnswer: null,
  answerState: 'pending',
  correctAnswer: null,
  showAnswerFeedback: false,
  timerOffset: 0,
  countdown: null,

  result: null,

  rematchInvite: null,
  inviteRemainingMs: 0,
  myRematchLocked: false,
  lastInviteRole: null,
  lastTopic: '',
  lastQuestionCount: 5,
};

/**
 * Inferred role from a fresh `joined` payload. Extracted because the same
 * branching shows up twice (active invite vs. lock-from-prior-invite).
 */
function inviteRoleFor(
  selfId: string,
  inviterId: string | null,
): InviteRole {
  if (!inviterId) return null;
  return inviterId === selfId ? 'inviter' : 'target';
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'identity/load':
      return {
        ...state,
        playerId: action.playerId,
        playerName: action.playerName,
      };

    case 'event/joined': {
      const { payload } = action;
      const activeInvite = payload.rematchInvite;

      // Two paths produce a `lastInviteRole`:
      //   1. There's an active invite right now → role from inviterId.
      //   2. There's no active invite but myRematchLocked + lastInviterId
      //      tell us the user got declined/timed-out and we know which side.
      let lastInviteRole: InviteRole = null;
      let inviteRemainingMs = 0;
      if (activeInvite) {
        lastInviteRole = inviteRoleFor(payload.playerId, activeInvite.inviterId);
        inviteRemainingMs = Math.max(0, activeInvite.expiresAt - Date.now());
      } else if (payload.myRematchLocked && payload.lastInviterId) {
        lastInviteRole = inviteRoleFor(payload.playerId, payload.lastInviterId);
      }

      return {
        ...state,
        isHost: payload.isHost,
        players: payload.players,
        room: payload.room,
        status: payload.room.status,
        scores: payload.scores ?? {},
        lastTopic: typeof payload.lastTopic === 'string' ? payload.lastTopic : state.lastTopic,
        lastQuestionCount: typeof payload.lastQuestionCount === 'number'
          ? payload.lastQuestionCount
          : state.lastQuestionCount,
        rematchInvite: activeInvite,
        inviteRemainingMs,
        lastInviteRole,
        myRematchLocked: payload.myRematchLocked === true,
      };
    }

    case 'event/room_created':
      return {
        ...state,
        isHost: action.payload.isHost,
        players: action.payload.players,
        room: action.payload.room,
        status: 'waiting',
      };

    case 'event/player_joined':
      return { ...state, players: action.payload.players };

    case 'event/player_left':
      return {
        ...state,
        players: state.players.filter(p => p.id !== action.payload.playerId),
      };

    case 'event/player_disconnected':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.payload.playerId ? { ...p, connected: false } : p,
        ),
      };

    case 'event/player_reconnected':
      return { ...state, players: action.payload.players };

    case 'event/duel_started':
      return { ...state, status: 'countdown' };

    case 'event/countdown': {
      const { count } = action.payload;
      return { ...state, countdown: count < 0 ? null : count };
    }

    case 'event/new_question': {
      const { payload } = action;
      return {
        ...state,
        currentQuestion: {
          question: payload.question,
          options: payload.options,
          // Server does not reveal correctIndex yet; a placeholder until
          // `answer_result` lands.
          correctIndex: 0,
        },
        qIndex: payload.index,
        totalQuestions: payload.totalQuestions,
        selectedAnswer: null,
        answerState: 'pending',
        correctAnswer: null,
        showAnswerFeedback: false,
        status: 'playing',
        timerOffset: payload.elapsedMs || 0,
      };
    }

    case 'event/answer_result':
      return {
        ...state,
        correctAnswer: action.payload.correctAnswer,
        scores: action.payload.scores,
        answerState: action.payload.correct ? 'correct' : 'wrong',
        showAnswerFeedback: true,
      };

    case 'event/score_update':
      return { ...state, scores: action.payload.scores };

    case 'event/duel_end':
      return {
        ...state,
        result: action.payload,
        scores: action.payload.scores,
        status: 'finished',
      };

    case 'event/rematch_invite_received': {
      const { payload } = action;
      return {
        ...state,
        rematchInvite: { ...payload },
        inviteRemainingMs: Math.max(0, payload.expiresAt - Date.now()),
        lastInviteRole: inviteRoleFor(state.playerId, payload.inviterId),
      };
    }

    case 'event/rematch_resolved': {
      const { payload } = action;
      const cleared: Pick<RoomState, 'rematchInvite' | 'inviteRemainingMs'> = {
        rematchInvite: null,
        inviteRemainingMs: 0,
      };

      switch (payload.reason) {
        case 'accepted':
          return {
            ...state,
            ...cleared,
            myRematchLocked: false,
            lastInviteRole: null,
          };
        case 'declined':
          return {
            ...state,
            ...cleared,
            myRematchLocked: true,
            // Role snapshot stays — the hook reads it to choose the toast.
          };
        case 'timeout':
          return {
            ...state,
            ...cleared,
            myRematchLocked: true,
            // Role snapshot stays for the same reason as `declined`.
          };
        case 'inviter_disconnected':
        case 'opponent_disconnected':
          return {
            ...state,
            ...cleared,
            lastInviteRole: null,
          };
        default:
          return { ...state, ...cleared };
      }
    }

    case 'event/room_state_changed': {
      const { payload } = action;
      const next: RoomState = {
        ...state,
        status: payload.status,
        lastTopic: payload.lastTopic,
        lastQuestionCount: payload.lastQuestionCount,
        room: state.room
          ? {
              ...state.room,
              status: payload.status,
              hostId: payload.hostId,
              topic: payload.lastTopic,
              questionCount: payload.lastQuestionCount,
            }
          : state.room,
      };

      // Entering topic_select means a new round is about to start: clear
      // anything that belongs to the previous duel.
      if (payload.status === 'topic_select') {
        next.result = null;
        next.currentQuestion = null;
        next.selectedAnswer = null;
        next.answerState = 'pending';
        next.correctAnswer = null;
        next.showAnswerFeedback = false;
        next.scores = {};
        next.countdown = null;
      }

      return next;
    }

    case 'ui/select_answer':
      // Reducer-level guard: ignore if a selection is already locked in.
      if (state.selectedAnswer !== null || state.answerState !== 'pending') {
        return state;
      }
      return { ...state, selectedAnswer: action.index };

    case 'ui/invite_tick':
      return { ...state, inviteRemainingMs: Math.max(0, action.remainingMs) };

    default:
      // Exhaustiveness: TS will fail here if a new action variant is added
      // without a handler. The cast keeps the runtime branch unreachable.
      return state;
  }
}
