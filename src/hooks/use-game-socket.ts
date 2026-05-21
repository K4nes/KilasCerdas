'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { Player, RoomStatus, RematchInvite } from '@/lib/types';
import type {
  JoinedPayload,
  RoomCreatedPayload,
  DuelEndPayload,
  RematchInviteReceived,
  RematchResolved,
  RoomStateChanged,
} from '@/lib/socket-events';
import { ToastList, type Toast, type ToastVariant } from '@/components/toast';
import type { GeneratedQuestion } from '@/components/topic-picker';

import type { Question } from '@/lib/types';

export interface RoomData {
  id: string;
  topic: string;
  questionCount: number;
  status: RoomStatus;
  currentQuestion?: number;
  hostId?: string;
}

export interface UseGameSocketReturn {
  playerId: string;
  playerName: string;
  isHost: boolean;
  players: Player[];
  roomData: RoomData | null;
  status: RoomStatus;

  countdown: number | null;
  currentQuestion: Question | null;
  qIndex: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  answerState: 'pending' | 'correct' | 'wrong' | 'timeout';
  correctAnswer: number | null;
  scores: Record<string, number>;
  timerWidth: number;
  timerColor: 'safe' | 'warn' | 'urgent';
  showAnswerFeedback: boolean;
  myScore: number;
  opponent: Player | undefined;
  opponentScore: number;
  timerBgClass: string;

  result: DuelEndPayload | null;

  rematchInvite: RematchInvite | null;
  inviteRemainingMs: number;
  myRematchLocked: boolean;
  lastInviteRole: 'inviter' | 'target' | null;
  lastTopic: string;
  lastQuestionCount: number;

  toasts: Toast[];
  pushToast: (message: string, variant?: ToastVariant) => void;

  confettiCanvasRef: React.RefObject<HTMLCanvasElement>;

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

const AVATAR_CARDS = ['card-purple', 'card-pink', 'card-blue', 'card-mint', 'card-amber'];
const AVATAR_TEXT  = ['text-on-purple', 'text-on-pink', 'text-on-blue', 'text-on-mint', 'text-on-amber'];

export { AVATAR_CARDS, AVATAR_TEXT };

export function useGameSocket(): UseGameSocketReturn {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id as string;

  const [mounted, setMounted] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [status, setStatus] = useState<RoomStatus>('waiting');

  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'pending' | 'correct' | 'wrong' | 'timeout'>('pending');
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [timerWidth, setTimerWidth] = useState(100);
  const [timerColor, setTimerColor] = useState<'safe' | 'warn' | 'urgent'>('safe');
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);

  const [result, setResult] = useState<DuelEndPayload | null>(null);

  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<number>(0);

  const [rematchInvite, setRematchInvite] = useState<RematchInvite | null>(null);
  const [inviteRemainingMs, setInviteRemainingMs] = useState(0);
  const [myRematchLocked, setMyRematchLocked] = useState(false);
  const [lastInviteRole, setLastInviteRole] = useState<'inviter' | 'target' | null>(null);
  const lastInviteRoleRef = useRef<'inviter' | 'target' | null>(null);
  const [lastTopic, setLastTopic] = useState<string>('');
  const [lastQuestionCount, setLastQuestionCount] = useState<number>(5);

  const pushToast = useCallback((message: string, variant: ToastVariant = 'neutral') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, message, variant }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastTimers.current.delete(timer);
    }, 3000);
    toastTimers.current.add(timer);
  }, []);

  useEffect(() => {
    setMounted(true);
    const pid  = localStorage.getItem('kilascerdas_player_id') || 'player_' + Math.random().toString(36).substring(2, 10);
    const name = localStorage.getItem('kilascerdas_player_name') || 'Player_' + Math.random().toString(36).substring(2, 6);
    setPlayerId(pid);
    setPlayerName(name);
    localStorage.setItem('kilascerdas_player_id', pid);
    localStorage.setItem('kilascerdas_player_name', name);
  }, []);

  useEffect(() => {
    if (!mounted || !roomId) return;
    const socket = getSocket();

    socket.on('joined', (data: JoinedPayload) => {
      setIsHost(data.isHost);
      setPlayers(data.players);
      setRoomData(data.room);
      setStatus(data.room.status);
      setScores(data.scores ?? {});

      if (typeof data.lastTopic === 'string') setLastTopic(data.lastTopic);
      if (typeof data.lastQuestionCount === 'number') {
        setLastQuestionCount(data.lastQuestionCount);
      }

      if (data.rematchInvite) {
        setRematchInvite(data.rematchInvite);
        setInviteRemainingMs(Math.max(0, data.rematchInvite.expiresAt - Date.now()));
        const role: 'inviter' | 'target' =
          data.rematchInvite.inviterId === data.playerId ? 'inviter' : 'target';
        setLastInviteRole(role);
        lastInviteRoleRef.current = role;
      } else {
        setRematchInvite(null);
        setInviteRemainingMs(0);
        if (data.myRematchLocked && data.lastInviterId) {
          const role: 'inviter' | 'target' =
            data.lastInviterId === data.playerId ? 'inviter' : 'target';
          setLastInviteRole(role);
          lastInviteRoleRef.current = role;
        } else {
          setLastInviteRole(null);
          lastInviteRoleRef.current = null;
        }
      }

      setMyRematchLocked(data.myRematchLocked === true);
    });

    socket.on('room_created', (data: RoomCreatedPayload) => {
      setIsHost(data.isHost);
      setPlayers(data.players);
      setRoomData(data.room);
      setStatus('waiting');
    });

    socket.on('player_joined', (data: { players: Player[] }) => setPlayers(data.players));
    socket.on('player_left', (data: { playerId: string }) => setPlayers(prev => prev.filter(p => p.id !== data.playerId)));

    socket.on('player_disconnected', (data: { playerId: string }) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, connected: false } : p));
    });
    socket.on('player_reconnected', (data: { players: Player[] }) => setPlayers(data.players));

    socket.on('error_message', (data: { message: string }) => {
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

    socket.on('duel_started', () => setStatus('countdown'));

    socket.on('countdown', (data: { count: number }) => {
      setCountdown(data.count);
      if (data.count < 0) setCountdown(null);
    });

    socket.on('new_question', (data: {
      index: number; question: string; options: string[];
      timeLimit: number; totalQuestions: number; elapsedMs?: number;
    }) => {
      setCurrentQuestion({
        question: data.question,
        options: data.options,
        correctIndex: 0,
      });
      setQIndex(data.index);
      setTotalQuestions(data.totalQuestions);
      setSelectedAnswer(null);
      setAnswerState('pending');
      setCorrectAnswer(null);
      setShowAnswerFeedback(false);
      setStatus('playing');

      const initialElapsed = data.elapsedMs || 0;
      const initialWidth = Math.max(0, 100 - (initialElapsed / 10000) * 100);
      setTimerWidth(initialWidth);
      setTimerColor(initialWidth < 30 ? 'urgent' : initialWidth < 60 ? 'warn' : 'safe');
      timerStartRef.current = Date.now() - initialElapsed;

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - timerStartRef.current;
        const remaining = Math.max(0, 100 - (elapsed / 10000) * 100);
        setTimerWidth(remaining);
        if (remaining < 30) setTimerColor('urgent');
        else if (remaining < 60) setTimerColor('warn');
        else setTimerColor('safe');
        if (elapsed >= 10000 && timerRef.current) clearInterval(timerRef.current);
      }, 50);
    });

    socket.on('answer_result', (data: { correct: boolean; correctAnswer: number; scores: Record<string, number> }) => {
      setCorrectAnswer(data.correctAnswer);
      setScores(data.scores);
      setAnswerState(data.correct ? 'correct' : 'wrong');
      setShowAnswerFeedback(true);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on('score_update', (data: { scores: Record<string, number> }) => {
      setScores(data.scores);
    });

    socket.on('duel_end', (data: DuelEndPayload) => {
      setResult(data);
      setScores(data.scores);
      setStatus('finished');
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on('rematch_invite_received', (data: RematchInviteReceived) => {
      const invite: RematchInvite = { ...data };
      setRematchInvite(invite);
      setInviteRemainingMs(Math.max(0, data.expiresAt - Date.now()));
      const role = data.inviterId === playerId ? 'inviter' : 'target';
      setLastInviteRole(role);
      lastInviteRoleRef.current = role;
    });

    socket.on('rematch_resolved', (data: RematchResolved) => {
      setRematchInvite(null);
      setInviteRemainingMs(0);

      if (data.reason === 'accepted') {
        setMyRematchLocked(false);
        setLastInviteRole(null);
        lastInviteRoleRef.current = null;
        return;
      }

      if (data.reason === 'declined') {
        setMyRematchLocked(true);
        if (data.declinerId !== playerId) {
          pushToast('Lawan menolak ajakan', 'pink');
        }
        return;
      }

      if (data.reason === 'timeout') {
        setMyRematchLocked(true);
        if (lastInviteRoleRef.current === 'inviter') {
          pushToast('Lawan tidak merespons', 'pink');
        } else {
          pushToast('Ajakan rematch berakhir', 'pink');
        }
        return;
      }

      if (data.reason === 'inviter_disconnected' || data.reason === 'opponent_disconnected') {
        setLastInviteRole(null);
        lastInviteRoleRef.current = null;
        pushToast('Lawan keluar room', 'neutral');
      }
    });

    socket.on('room_state_changed', (data: RoomStateChanged) => {
      setStatus(data.status);
      setLastTopic(data.lastTopic);
      setLastQuestionCount(data.lastQuestionCount);
      setRoomData(prev => prev ? {
        ...prev,
        status: data.status,
        hostId: data.hostId,
        topic: data.lastTopic,
        questionCount: data.lastQuestionCount,
      } : prev);
      if (data.status === 'topic_select') {
        setResult(null);
        setCurrentQuestion(null);
        setSelectedAnswer(null);
        setAnswerState('pending');
        setCorrectAnswer(null);
        setShowAnswerFeedback(false);
        setScores({});
        setCountdown(null);
      }
    });

    socket.emit('join_room', { roomId, playerName, playerId });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      toastTimers.current.forEach(clearTimeout);
      toastTimers.current.clear();
    };
  }, [mounted, roomId, playerName, playerId, router, pushToast]);

  const handleStartDuel = () => getSocket().emit('start_duel', { roomId });

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null || answerState !== 'pending') return;
    setSelectedAnswer(index);
    getSocket().emit('submit_answer', { roomId, answer: index, playerId });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRematch = () => {
    getSocket().emit('rematch_invite', { roomId });
  };

  const handleAcceptRematch = () => {
    getSocket().emit('rematch_response', { roomId, accept: true });
  };

  const handleDeclineRematch = () => {
    getSocket().emit('rematch_response', { roomId, accept: false });
  };

  const handleRematchStart = (topic: string, questions: GeneratedQuestion[]) =>
    new Promise<void>((resolve, reject) => {
      const socket = getSocket();
      const timeoutId = setTimeout(() => {
        socket.off('duel_started', onDuelStarted);
        socket.off('error_message', onError);
        reject(new Error('Timeout memulai duel. Coba lagi.'));
      }, 10000);
      const onDuelStarted = () => {
        clearTimeout(timeoutId);
        socket.off('duel_started', onDuelStarted);
        socket.off('error_message', onError);
        resolve();
      };
      const onError = (data: { message: string }) => {
        clearTimeout(timeoutId);
        socket.off('duel_started', onDuelStarted);
        socket.off('error_message', onError);
        reject(new Error(data.message || 'Gagal memulai duel'));
      };
      socket.once('duel_started', onDuelStarted);
      socket.once('error_message', onError);
      socket.emit('rematch_start', {
        roomId,
        topic,
        questions,
        questionCount: questions.length,
      });
    });

  const handleGoHome = () => { disconnectSocket(); router.push('/'); };

  useEffect(() => {
    if (!rematchInvite || rematchInvite.inviterId !== playerId) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, rematchInvite.expiresAt - Date.now());
      setInviteRemainingMs(remaining);
    }, 100);
    return () => clearInterval(id);
  }, [rematchInvite, playerId]);

  const myScore       = scores[playerId] || 0;
  const opponent      = players.find(p => p.id !== playerId);
  const opponentScore = opponent ? (scores[opponent.id] || 0) : 0;

  const timerBgClass =
    timerColor === 'urgent' ? 'bg-urgent'
    : timerColor === 'warn' ? 'bg-accent-pink'
    : 'bg-accent-violet';

  return {
    playerId, playerName, isHost, players, roomData, status,
    countdown, currentQuestion, qIndex, totalQuestions,
    selectedAnswer, answerState, correctAnswer, scores,
    timerWidth, timerColor, showAnswerFeedback,
    myScore, opponent, opponentScore, timerBgClass,
    result,
    rematchInvite, inviteRemainingMs, myRematchLocked,
    lastInviteRole, lastTopic, lastQuestionCount,
    toasts, pushToast,
    confettiCanvasRef,
    handleStartDuel, handleAnswer, handleCopyCode,
    handleRematch, handleAcceptRematch, handleDeclineRematch,
    handleRematchStart, handleGoHome,
    copied,
  };
}
