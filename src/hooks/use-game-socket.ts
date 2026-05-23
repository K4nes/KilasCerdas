'use client';

import { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { RematchInvite, Player } from '@/lib/types';
import { Events } from '@/lib/socket-events';
import type {
  JoinedPayload,
  RoomCreatedPayload,
  DuelEndPayload,
  RematchInviteReceived,
  RematchResolved,
  RoomStateChanged,
  NewQuestionPayload,
  AnswerResultPayload,
  ScoreUpdatePayload,
  CountdownPayload,
  ErrorPayload,
  PlayersPayload,
  PlayerIdPayload,
} from '@/lib/socket-events';
import { useTimer } from '@/hooks/use-timer';
import { ToastList, type Toast, type ToastVariant } from '@/components/toast';
import type { GeneratedQuestion } from '@/components/topic-picker';
import { QUESTION_TIME_LIMIT_MS, SERVER_ACK_TIMEOUT_MS } from '@/lib/game-config';
import {
  roomReducer,
  initialRoomState,
  type RoomState,
  type RoomData,
  type AnswerState,
  type InviteRole,
} from '@/lib/room-reducer';

/**
 * useGameSocket — wires the room state machine (`roomReducer`) to the
 * Socket.io transport, plus the side effects screens need (toasts,
 * clipboard, navigation, invite countdown ticker).
 *
 * Architecture:
 *   ┌─────────────────────────┐    Events.* payloads
 *   │      Socket.io          │ ───────────────────────┐
 *   └─────────────────────────┘                        ▼
 *                                          ┌─────────────────────┐
 *                                          │   roomReducer       │  pure
 *                                          │  (room-reducer.ts)  │
 *                                          └─────────────────────┘
 *                                                     │
 *                                                     ▼
 *   screens read selector results ◄──── RoomState ────┘
 *
 * Pure state lives in the reducer (and is testable without React or
 * Socket.io — see room-reducer.test.ts). Transient UI state that doesn't
 * survive a refresh and isn't worth event-sourcing — `toasts` and
 * `copied` — stays in component-local useState.
 *
 * The return shape is preserved against earlier callers; screens import
 * fields by name (`status`, `qIndex`, `myScore`, etc.) and don't need to
 * change.
 */

const AVATAR_CARDS = ['card-purple', 'card-pink', 'card-blue', 'card-mint', 'card-amber'];
const AVATAR_TEXT  = ['text-on-purple', 'text-on-pink', 'text-on-blue', 'text-on-mint', 'text-on-amber'];

export { AVATAR_CARDS, AVATAR_TEXT };
export type { RoomData };

export interface UseGameSocketReturn {
  // ── Identity / room ──
  playerId: string;
  playerName: string;
  isHost: boolean;
  players: Player[];
  roomData: RoomData | null;
  status: RoomState['status'];

  // ── Duel ──
  countdown: number | null;
  currentQuestion: RoomState['currentQuestion'];
  qIndex: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  answerState: AnswerState;
  correctAnswer: number | null;
  scores: Record<string, number>;
  timerWidth: number;
  showAnswerFeedback: boolean;
  myScore: number;
  opponent: Player | undefined;
  opponentScore: number;
  timerBgClass: string;

  // ── Result ──
  result: DuelEndPayload | null;

  // ── Rematch ──
  rematchInvite: RematchInvite | null;
  inviteRemainingMs: number;
  myRematchLocked: boolean;
  lastInviteRole: InviteRole;
  lastTopic: string;
  lastQuestionCount: number;

  // ── UI ephemera ──
  toasts: Toast[];
  pushToast: (message: string, variant?: ToastVariant) => void;
  confettiCanvasRef: React.RefObject<HTMLCanvasElement>;

  // ── Actions ──
  handleStartDuel: () => void;
  handleAnswer: (index: number) => void;
  handleCopyCode: () => void;
  handleRematch: () => void;
  handleAcceptRematch: () => void;
  handleDeclineRematch: () => void;
  handleRematchStart: (topic: string, questions: GeneratedQuestion[]) => Promise<void>;
  handleGoHome: () => void;

  copied: boolean;
}

// `ToastList` is re-exported so screens that already import via
// `@/hooks/use-game-socket` can keep their import path. (Not strictly
// part of the hook's interface, but preserved for stability.)
export { ToastList };

export function useGameSocket(): UseGameSocketReturn {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id as string;

  const [mounted, setMounted] = useState(false);
  const [state, dispatch] = useReducer(roomReducer, initialRoomState);

  // ── Transient UI state — not event-sourced, not in reducer. ──
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  // The hook still needs to read role-at-resolution-time inside socket
  // callbacks (closures over a stale state would mis-toast). We mirror
  // the reducer's lastInviteRole into a ref so callbacks read the latest
  // value without re-subscribing. This is the one place state escapes the
  // reducer — kept narrow, documented, and one-way (reducer → ref).
  const lastInviteRoleRef = useRef<InviteRole>(state.lastInviteRole);
  useEffect(() => {
    lastInviteRoleRef.current = state.lastInviteRole;
  }, [state.lastInviteRole]);

  const pushToast = useCallback((message: string, variant: ToastVariant = 'neutral') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, message, variant }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastTimers.current.delete(timer);
    }, 3000);
    toastTimers.current.add(timer);
  }, []);

  // ── Identity bootstrap (one-time, from localStorage). ──
  useEffect(() => {
    setMounted(true);
    const pid  = localStorage.getItem('kilascerdas_player_id') || 'player_' + Math.random().toString(36).substring(2, 10);
    const name = localStorage.getItem('kilascerdas_player_name') || 'Player_' + Math.random().toString(36).substring(2, 6);
    localStorage.setItem('kilascerdas_player_id', pid);
    localStorage.setItem('kilascerdas_player_name', name);
    dispatch({ type: 'identity/load', playerId: pid, playerName: name });
  }, []);

  // ── Wire ↔ reducer bridge. ──
  useEffect(() => {
    if (!mounted || !roomId) return;
    const socket = getSocket();

    socket.on(Events.JOINED, (payload: JoinedPayload) => {
      dispatch({ type: 'event/joined', payload });
    });
    socket.on(Events.ROOM_CREATED, (payload: RoomCreatedPayload) => {
      dispatch({ type: 'event/room_created', payload });
    });
    socket.on(Events.PLAYER_JOINED, (payload: PlayersPayload) => {
      dispatch({ type: 'event/player_joined', payload });
    });
    socket.on(Events.PLAYER_LEFT, (payload: PlayerIdPayload) => {
      dispatch({ type: 'event/player_left', payload });
    });
    socket.on(Events.PLAYER_DISCONNECTED, (payload: PlayerIdPayload) => {
      dispatch({ type: 'event/player_disconnected', payload });
    });
    socket.on(Events.PLAYER_RECONNECTED, (payload: PlayersPayload) => {
      dispatch({ type: 'event/player_reconnected', payload });
    });
    socket.on(Events.DUEL_STARTED, () => {
      dispatch({ type: 'event/duel_started' });
    });
    socket.on(Events.COUNTDOWN, (payload: CountdownPayload) => {
      dispatch({ type: 'event/countdown', payload });
    });
    socket.on(Events.NEW_QUESTION, (payload: NewQuestionPayload) => {
      dispatch({ type: 'event/new_question', payload });
    });
    socket.on(Events.ANSWER_RESULT, (payload: AnswerResultPayload) => {
      dispatch({ type: 'event/answer_result', payload });
    });
    socket.on(Events.SCORE_UPDATE, (payload: ScoreUpdatePayload) => {
      dispatch({ type: 'event/score_update', payload });
    });
    socket.on(Events.DUEL_END, (payload: DuelEndPayload) => {
      dispatch({ type: 'event/duel_end', payload });
    });
    socket.on(Events.REMATCH_INVITE_RECEIVED, (payload: RematchInviteReceived) => {
      dispatch({ type: 'event/rematch_invite_received', payload });
    });
    socket.on(Events.REMATCH_RESOLVED, (payload: RematchResolved) => {
      // Reducer handles state; the hook owns the toast side effect because
      // it needs the role-at-resolution-time and the toast queue.
      dispatch({ type: 'event/rematch_resolved', payload });
      const selfId = state.playerId;
      switch (payload.reason) {
        case 'declined':
          if (payload.declinerId !== selfId) pushToast('Lawan menolak ajakan', 'pink');
          break;
        case 'timeout':
          if (lastInviteRoleRef.current === 'inviter') {
            pushToast('Lawan tidak merespons', 'pink');
          } else {
            pushToast('Ajakan rematch berakhir', 'pink');
          }
          break;
        case 'inviter_disconnected':
        case 'opponent_disconnected':
          pushToast('Lawan keluar room', 'neutral');
          break;
      }
    });
    socket.on(Events.ROOM_STATE_CHANGED, (payload: RoomStateChanged) => {
      dispatch({ type: 'event/room_state_changed', payload });
    });
    socket.on(Events.ERROR_MESSAGE, (data: ErrorPayload) => {
      pushToast(data.message, 'red');
      if (
        data.message === 'Host meninggalkan room' ||
        data.message === 'Lawan keluar room'
      ) {
        setTimeout(() => {
          disconnectSocket();
          router.push('/');
        }, 1500);
      }
    });

    socket.emit(Events.JOIN_ROOM, {
      roomId,
      playerName: state.playerName,
      playerId: state.playerId,
    });

    return () => {
      toastTimers.current.forEach(clearTimeout);
      toastTimers.current.clear();
    };
    // We intentionally read state.playerId/Name fresh on mount-effect runs;
    // adding them as deps would re-subscribe to the socket every identity
    // tick. The wire setup runs once per room visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, roomId, router, pushToast]);

  // ── Invite countdown tick — only the inviter renders a live remaining
  // counter; the target gets it from the rematch modal which has its own
  // tick. We dispatch into the reducer so the value can be selected from
  // a single state shape.
  useEffect(() => {
    const invite = state.rematchInvite;
    if (!invite || invite.inviterId !== state.playerId) return;
    const id = setInterval(() => {
      dispatch({
        type: 'ui/invite_tick',
        remainingMs: Math.max(0, invite.expiresAt - Date.now()),
      });
    }, 100);
    return () => clearInterval(id);
  }, [state.rematchInvite, state.playerId]);

  // ── Action handlers — emit + (where needed) optimistic dispatch. ──
  const handleStartDuel = () => getSocket().emit(Events.START_DUEL, { roomId });

  const handleAnswer = (index: number) => {
    if (state.selectedAnswer !== null || state.answerState !== 'pending') return;
    dispatch({ type: 'ui/select_answer', index });
    getSocket().emit(Events.SUBMIT_ANSWER, {
      roomId,
      answer: index,
      playerId: state.playerId,
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRematch = () => {
    getSocket().emit(Events.REMATCH_INVITE, { roomId });
  };

  const handleAcceptRematch = () => {
    getSocket().emit(Events.REMATCH_RESPONSE, { roomId, accept: true });
  };

  const handleDeclineRematch = () => {
    getSocket().emit(Events.REMATCH_RESPONSE, { roomId, accept: false });
  };

  const handleRematchStart = (topic: string, questions: GeneratedQuestion[]) =>
    new Promise<void>((resolve, reject) => {
      const socket = getSocket();
      const timeoutId = setTimeout(() => {
        socket.off(Events.DUEL_STARTED, onDuelStarted);
        socket.off(Events.ERROR_MESSAGE, onError);
        reject(new Error('Timeout memulai duel. Coba lagi.'));
      }, SERVER_ACK_TIMEOUT_MS);
      const onDuelStarted = () => {
        clearTimeout(timeoutId);
        socket.off(Events.DUEL_STARTED, onDuelStarted);
        socket.off(Events.ERROR_MESSAGE, onError);
        resolve();
      };
      const onError = (data: { message: string }) => {
        clearTimeout(timeoutId);
        socket.off(Events.DUEL_STARTED, onDuelStarted);
        socket.off(Events.ERROR_MESSAGE, onError);
        reject(new Error(data.message || 'Gagal memulai duel'));
      };
      socket.once(Events.DUEL_STARTED, onDuelStarted);
      socket.once(Events.ERROR_MESSAGE, onError);
      socket.emit(Events.REMATCH_START, {
        roomId,
        topic,
        questions,
        questionCount: questions.length,
      });
    });

  const handleGoHome = () => { disconnectSocket(); router.push('/'); };

  // ── Derived selectors. Cheap to compute on every render; no need for
  // memoization unless they show up as a perf hot-spot. Keep them inline
  // so screens read them as named fields. ──
  const myScore = state.scores[state.playerId] || 0;
  const opponent = state.players.find(p => p.id !== state.playerId);
  const opponentScore = opponent ? (state.scores[opponent.id] || 0) : 0;

  // The timer is keyed on (qIndex, timerOffset) so it resets when the
  // server says "new question". Paused while not playing or while
  // showing reveal feedback.
  const timerKey = `${state.qIndex}-${state.timerOffset}`;
  const { width: timerWidth, bgClass: timerBgClass } = useTimer(
    QUESTION_TIME_LIMIT_MS,
    timerKey,
    state.timerOffset,
    state.showAnswerFeedback || state.status !== 'playing',
  );

  return {
    playerId: state.playerId,
    playerName: state.playerName,
    isHost: state.isHost,
    players: state.players,
    roomData: state.room,
    status: state.status,

    countdown: state.countdown,
    currentQuestion: state.currentQuestion,
    qIndex: state.qIndex,
    totalQuestions: state.totalQuestions,
    selectedAnswer: state.selectedAnswer,
    answerState: state.answerState,
    correctAnswer: state.correctAnswer,
    scores: state.scores,
    timerWidth,
    showAnswerFeedback: state.showAnswerFeedback,
    myScore,
    opponent,
    opponentScore,
    timerBgClass,

    result: state.result,

    rematchInvite: state.rematchInvite,
    inviteRemainingMs: state.inviteRemainingMs,
    myRematchLocked: state.myRematchLocked,
    lastInviteRole: state.lastInviteRole,
    lastTopic: state.lastTopic,
    lastQuestionCount: state.lastQuestionCount,

    toasts,
    pushToast,
    confettiCanvasRef,

    handleStartDuel,
    handleAnswer,
    handleCopyCode,
    handleRematch,
    handleAcceptRematch,
    handleDeclineRematch,
    handleRematchStart,
    handleGoHome,

    copied,
  };
}
