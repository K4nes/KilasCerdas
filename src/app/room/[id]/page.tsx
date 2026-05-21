'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Check, Users, Clock, Zap, Brain, RefreshCw, Home, Crown, Sparkles, Trophy, Loader2 } from 'lucide-react';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { ToastList, type Toast, type ToastVariant } from '@/components/toast';
import RematchModal from '@/components/rematch-modal';
import TopicPicker, { type GeneratedQuestion } from '@/components/topic-picker';

// ─── Types ────────────────────────────────────────────────────
interface Player {
  id: string;
  name: string;
  socketId: string;
  connected?: boolean;
}

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished' | 'topic_select';

interface RoomData {
  id: string;
  topic: string;
  questionCount: number;
  status: RoomStatus;
  currentQuestion?: number;
  hostId?: string;
}

interface RematchInvite {
  inviterId: string;
  inviterName: string;
  expiresAt: number;
}

// ─── Confetti Engine ───────────────────────────────────────────
function createConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const particles: {
    x: number; y: number; vx: number; vy: number;
    size: number; color: string; rotation: number; rotationSpeed: number;
    opacity: number; shape: 'rect' | 'circle';
  }[] = [];

  const colors = [
    'oklch(66% 0.22 0)',     // pink
    'oklch(60% 0.22 295)',   // violet
    'oklch(75% 0.16 240)',   // sky
    'oklch(80% 0.14 85)',    // amber
    'oklch(75% 0.18 150)',   // mint
    'oklch(70% 0.20 320)',   // magenta
  ];

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  for (let i = 0; i < 220; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 7,
      vy: Math.random() * 3 + 2,
      size: Math.random() * 9 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    });
  }

  let animId = 0;
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.0028;
      if (p.opacity <= 0) continue;
      alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (alive) animId = requestAnimationFrame(animate);
  };
  animate();
  return () => cancelAnimationFrame(animId);
}

const AVATAR_CARDS = ['card-purple', 'card-pink', 'card-blue', 'card-mint', 'card-amber'];
const AVATAR_TEXT  = ['text-on-purple', 'text-on-pink', 'text-on-blue', 'text-on-mint', 'text-on-amber'];

// ─── Room Page ─────────────────────────────────────────────────
export default function RoomPage() {
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

  // Duel state
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

  // Result state
  const [result, setResult] = useState<{
    winner: { name: string; id: string } | null;
    scores: Record<string, number>;
    stats: { name: string; score: number; isWinner: boolean }[];
    topic: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const stopConfettiRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);

  // ─── Rematch state ────────────────────────────────────────────
  // `rematchInvite !== null` indicates a pending invite. Whether *I* am the
  // inviter or the target is derived from `inviterId === playerId`.
  // - inviting → I sent it, button shows spinner + countdown
  // - incoming → opponent sent it, modal mounts on top (button stays idle)
  // - locked   → previous invite was declined/timed out (slice 04, symmetric)
  // - else     → button is `idle`
  const [rematchInvite, setRematchInvite] = useState<RematchInvite | null>(null);
  // Live ms-remaining for the inviter's button countdown. Synced from
  // rematchInvite.expiresAt via setInterval; cleared on transitions.
  const [inviteRemainingMs, setInviteRemainingMs] = useState(0);
  // Slice 04 — symmetric lock state. Both players go locked on decline/timeout;
  // both reset to false on a successful accept (server is the source of truth,
  // but reload-restore is slice 06's job — this slice will regress to idle on
  // reload, that's expected).
  const [myRematchLocked, setMyRematchLocked] = useState(false);
  // What role I had in the last invite cycle, used to pick the right subtitle
  // and toast on `rematch_resolved`. Set when a new invite arrives, cleared
  // when accept loops back. Persists alongside `myRematchLocked` so the
  // locked-state subtitle can render correctly after the invite itself
  // disappears.
  const [lastInviteRole, setLastInviteRole] = useState<'inviter' | 'target' | null>(null);
  // Mirror of lastInviteRole so the socket handler closure (registered once
  // per mount) can read the up-to-date role without re-attaching listeners.
  const lastInviteRoleRef = useRef<'inviter' | 'target' | null>(null);
  // Carried from `room_state_changed` so TopicPicker can pre-fill in
  // topic_select when the host re-renders. Falls back to roomData.topic.
  const [lastTopic, setLastTopic] = useState<string>('');
  const [lastQuestionCount, setLastQuestionCount] = useState<number>(5);

  // ─── Toast helpers ───────────────────────────────────────────
  const pushToast = useCallback((message: string, variant: ToastVariant = 'neutral') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, message, variant }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastTimers.current.delete(timer);
    }, 3000);
    toastTimers.current.add(timer);
  }, []);

  // ─── Init ────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const pid  = localStorage.getItem('kilascerdas_player_id') || 'player_' + Math.random().toString(36).substring(2, 10);
    const name = localStorage.getItem('kilascerdas_player_name') || 'Player_' + Math.random().toString(36).substring(2, 6);
    setPlayerId(pid);
    setPlayerName(name);
    localStorage.setItem('kilascerdas_player_id', pid);
    localStorage.setItem('kilascerdas_player_name', name);
  }, []);

  // ─── Socket ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !roomId) return;
    const socket = getSocket();

    socket.on('joined', (data) => {
      setIsHost(data.isHost);
      setPlayers(data.players);
      setRoomData(data.room);
      setStatus(data.room.status);

      // Slice 06: restore rematch state from the extended payload so reload
      // during inviting/locked/topic_select reconstructs cleanly.
      //
      // `lastTopic`/`lastQuestionCount` always present (server sends them
      // unconditionally; they're harmless outside topic_select but become the
      // pre-fill source for the host's TopicPicker when re-rendering inside
      // topic_select after reload).
      if (typeof data.lastTopic === 'string') setLastTopic(data.lastTopic);
      if (typeof data.lastQuestionCount === 'number') {
        setLastQuestionCount(data.lastQuestionCount);
      }

      if (data.rematchInvite) {
        // Live invite in flight on reload. Hydrate state + ref so the
        // inviter's countdown effect picks up immediately and the modal
        // mounts for the target. expiresAt is absolute, so the countdown
        // effect already computes remaining via `expiresAt - Date.now()`
        // each tick — no special handling needed.
        setRematchInvite(data.rematchInvite);
        setInviteRemainingMs(Math.max(0, data.rematchInvite.expiresAt - Date.now()));
        const role: 'inviter' | 'target' =
          data.rematchInvite.inviterId === data.playerId ? 'inviter' : 'target';
        setLastInviteRole(role);
        lastInviteRoleRef.current = role;
      } else {
        // No live invite. If I'm locked, derive role from server-persisted
        // `lastInviterId` so the locked subtitle reads correctly after
        // reload. Without this, slice 04's locked-button subtitle would
        // collapse to the generic "Rematch ditolak" for everyone — fine for
        // the decliner, wrong for the inviter (who should see "Lawan
        // menolak").
        setRematchInvite(null);
        setInviteRemainingMs(0);
        if (data.myRematchLocked && data.lastInviterId) {
          const role: 'inviter' | 'target' =
            data.lastInviterId === data.playerId ? 'inviter' : 'target';
          setLastInviteRole(role);
          lastInviteRoleRef.current = role;
        } else {
          // Either not locked, or locked but no persisted inviter (defensive
          // — shouldn't happen, but fall back to clearing role rather than
          // showing a stale one from a previous reload).
          setLastInviteRole(null);
          lastInviteRoleRef.current = null;
        }
      }

      setMyRematchLocked(data.myRematchLocked === true);
    });

    socket.on('room_created', (data) => {
      setIsHost(data.isHost);
      setPlayers(data.players);
      setRoomData(data.room);
      setStatus('waiting');
    });

    socket.on('player_joined', (data) => setPlayers(data.players));
    socket.on('player_left',   (data) => setPlayers(prev => prev.filter(p => p.id !== data.playerId)));

    socket.on('player_disconnected', (data) => {
      setPlayers(prev => prev.map(p => p.id === data.playerId ? { ...p, connected: false } : p));
    });
    socket.on('player_reconnected', (data) => setPlayers(data.players));

    socket.on('error_message', (data) => {
      pushToast(data.message, 'red');
      // Slice 05: messages emitted by the topic_select 60s-timeout teardown
      // signal that the room has been deleted server-side. Show the toast,
      // then redirect home so the user isn't stranded on a dead room.
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

    socket.on('countdown', (data) => {
      setCountdown(data.count);
      if (data.count < 0) setCountdown(null);
    });

    socket.on('new_question', (data) => {
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
      setTimerWidth(100);
      setTimerColor('safe');
      timerStartRef.current = Date.now();

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

    socket.on('answer_result', (data) => {
      setCorrectAnswer(data.correctAnswer);
      setScores(data.scores);
      setAnswerState(data.correct ? 'correct' : 'wrong');
      setShowAnswerFeedback(true);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on('duel_end', (data) => {
      setResult(data);
      setStatus('finished');
      if (timerRef.current) clearInterval(timerRef.current);
      requestAnimationFrame(() => {
        if (confettiCanvasRef.current) {
          stopConfettiRef.current = createConfetti(confettiCanvasRef.current);
        }
      });
    });

    // ─── Rematch flow ────────────────────────────────────────────
    socket.on('rematch_invite_received', (data: RematchInvite) => {
      setRematchInvite(data);
      setInviteRemainingMs(Math.max(0, data.expiresAt - Date.now()));
      // Track my role for the subsequent `rematch_resolved` so we can pick
      // the right toast/subtitle. Cleared on accept loop-back.
      const role = data.inviterId === playerId ? 'inviter' : 'target';
      setLastInviteRole(role);
      lastInviteRoleRef.current = role;
    });

    socket.on('rematch_resolved', (data: {
      accepted: boolean;
      declinerId: string | null;
      reason: 'accepted' | 'declined' | 'timeout' | 'inviter_disconnected' | 'opponent_disconnected';
    }) => {
      // Always clear local invite + countdown — the invite cycle is over.
      setRematchInvite(null);
      setInviteRemainingMs(0);

      if (data.reason === 'accepted') {
        // Loop back to idle for the next rematch round. Screen transition is
        // driven by `room_state_changed` below.
        setMyRematchLocked(false);
        setLastInviteRole(null);
        lastInviteRoleRef.current = null;
        return;
      }

      if (data.reason === 'declined') {
        // Symmetric lock: both players locked.
        setMyRematchLocked(true);
        if (data.declinerId === playerId) {
          // I declined — modal action was explicit feedback enough; no toast.
          // Subtitle on my locked button will read "Rematch ditolak".
        } else {
          // I was the inviter (the only other side that can receive declined).
          pushToast('Lawan menolak ajakan', 'pink');
        }
        return;
      }

      if (data.reason === 'timeout') {
        // Symmetric lock on auto-decline. Toast depends on my role; read from
        // ref so we see the up-to-date value (this handler closure was
        // registered at mount and never re-binds).
        setMyRematchLocked(true);
        if (lastInviteRoleRef.current === 'inviter') {
          pushToast('Lawan tidak merespons', 'pink');
        } else {
          // Target who AFK'd through the modal — let them know the cycle ended.
          pushToast('Ajakan rematch berakhir', 'pink');
        }
        return;
      }

      // Slice 05: disconnect-driven reasons. No lock — disconnect is not
      // rejection. Both reasons surface the same neutral toast to the
      // surviving party. The button will naturally render as
      // `opponent_offline` once `player_disconnected` flips connected=false.
      if (
        data.reason === 'inviter_disconnected' ||
        data.reason === 'opponent_disconnected'
      ) {
        // Always clear role tracking — the cycle is over and there's no
        // locked state to subtitle for.
        setLastInviteRole(null);
        lastInviteRoleRef.current = null;
        pushToast('Lawan keluar room', 'neutral');
        return;
      }
    });

    socket.on('room_state_changed', (data: {
      status: RoomStatus;
      hostId: string;
      lastTopic: string;
      lastQuestionCount: number;
    }) => {
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
      // Match #N reset: clear any stale duel state so the new countdown +
      // questions render cleanly when status flips back to countdown/playing.
      if (data.status === 'topic_select') {
        setResult(null);
        setCurrentQuestion(null);
        setSelectedAnswer(null);
        setAnswerState('pending');
        setCorrectAnswer(null);
        setShowAnswerFeedback(false);
        setScores({});
        setCountdown(null);
        if (stopConfettiRef.current) {
          stopConfettiRef.current();
          stopConfettiRef.current = null;
        }
      }
    });

    socket.emit('join_room', { roomId, playerName, playerId });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopConfettiRef.current) stopConfettiRef.current();
      toastTimers.current.forEach(clearTimeout);
      toastTimers.current.clear();
    };
  }, [mounted, roomId, playerName, playerId]);

  // ─── Handlers ────────────────────────────────────────────────
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Slice 03: replace the old disconnect+redirect with an in-room invite.
  // Server broadcasts `rematch_invite_received` back to both players so the
  // inviter's local button state is driven by the same event, not by an
  // optimistic local mutation here.
  const handleRematch = () => {
    getSocket().emit('rematch_invite', { roomId });
  };

  const handleAcceptRematch = () => {
    getSocket().emit('rematch_response', { roomId, accept: true });
  };

  const handleDeclineRematch = () => {
    getSocket().emit('rematch_response', { roomId, accept: false });
  };

  // Host TopicPicker submit handler — emits rematch_start, holds the
  // picker's loading spinner until the server confirms via `duel_started`.
  // Mirrors the /create page's create_room round-trip pattern.
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

  // ─── Inviter button live countdown ───────────────────────────
  // Tick at 100ms so the integer-second label updates smoothly. Only runs
  // while *I* am the inviter (modal handles its own ticking for the target).
  useEffect(() => {
    if (!rematchInvite || rematchInvite.inviterId !== playerId) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, rematchInvite.expiresAt - Date.now());
      setInviteRemainingMs(remaining);
    }, 100);
    return () => clearInterval(id);
  }, [rematchInvite, playerId]);

  // ─── Helpers ─────────────────────────────────────────────────
  const myScore       = scores[playerId] || 0;
  const opponent      = players.find(p => p.id !== playerId);
  const opponentScore = opponent ? (scores[opponent.id] || 0) : 0;

  const timerBgClass =
    timerColor === 'urgent' ? 'bg-feedback-urgent'
    : timerColor === 'warn' ? 'bg-accent-pink'
    : 'bg-accent-gradient';

  // ─── Loading ─────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // ─── Result ──────────────────────────────────────────────────
  if (status === 'finished' && result) {
    const isWinner = result.winner?.id === playerId;
    // Visual state for the "Tantang Lagi" button. Five states.
    // Precedence: an in-flight invite (inviting/incoming) wins over everything
    // else — the server prevents new invites when locked or while opponent is
    // offline, so this only matters in resolved states. Below `incoming`,
    // `opponent_offline` wins over `locked` because the opponent being absent
    // is a more current/actionable signal than a stale rejection from the
    // previous cycle.
    const opponentOffline = opponent ? opponent.connected === false : false;
    const rematchButtonState:
      | 'idle'
      | 'inviting'
      | 'incoming'
      | 'opponent_offline'
      | 'locked' =
      rematchInvite
        ? rematchInvite.inviterId === playerId
          ? 'inviting'
          : 'incoming'
        : opponentOffline
          ? 'opponent_offline'
          : myRematchLocked
            ? 'locked'
            : 'idle';
    const inviteRemainingSec = Math.ceil(inviteRemainingMs / 1000);
    // Subtitle text for the locked state. Per spec Section 6: inviter sees
    // "Lawan menolak"; the decliner / AFK target sees "Rematch ditolak".
    const lockedSubtitle =
      lastInviteRole === 'inviter' ? 'Lawan menolak' : 'Rematch ditolak';

    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <ToastList toasts={toasts} />
        <canvas ref={confettiCanvasRef} id="confetti-canvas" />

        {/* Modal mounts on top when opponent invited me. Backdrop intentionally
            non-dismissable; only Terima/Tolak/server timeout closes it. */}
        {rematchButtonState === 'incoming' && rematchInvite && (
          <RematchModal
            inviterName={rematchInvite.inviterName}
            lastTopic={roomData?.topic || result.topic || 'Umum'}
            expiresAt={rematchInvite.expiresAt}
            onAccept={handleAcceptRematch}
            onDecline={handleDeclineRematch}
          />
        )}

        <div className="max-w-md w-full space-y-6 text-center animate-scale-in relative z-10">
          {/* Trophy */}
          <div className="space-y-3">
            <div className={`mx-auto w-24 h-24 rounded-3xl flex items-center justify-center text-5xl
              ${isWinner ? 'bg-accent-gradient shadow-glow animate-bounce-in' : 'bg-card-blue'}`}>
              {isWinner ? '🏆' : '💪'}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-black text-ink leading-tight">
              {isWinner ? 'Kamu Menang!' : `${result.winner?.name || 'Lawan'} Menang`}
            </h1>
            <p className="text-muted">
              {isWinner ? 'Selamat! Kamu yang terpintar 🎉' : 'Jangan menyerah, coba lagi!'}
            </p>
          </div>

          {/* Score comparison */}
          <div className="card !p-6 space-y-5">
            <h3 className="font-display text-xs font-bold text-muted tracking-wider uppercase">
              Skor Akhir
            </h3>

            <div className="grid grid-cols-2 gap-4 items-stretch">
              <div className="card card-purple !p-4 !shadow-xs">
                <p className="text-on-purple/80 text-sm font-bold truncate">{playerName || 'Kamu'}</p>
                <p className="text-on-purple/60 text-[10px] font-semibold tracking-wider uppercase mb-2">Kamu</p>
                <p className="font-display text-3xl font-black text-on-purple tabular-nums">{myScore}</p>
              </div>
              <div className="card card-pink !p-4 !shadow-xs">
                {opponent?.name ? (
                  <>
                    <p className="text-on-pink/80 text-sm font-bold truncate">{opponent.name}</p>
                    <p className="text-on-pink/60 text-[10px] font-semibold tracking-wider uppercase mb-2">Lawan</p>
                  </>
                ) : (
                  <p className="text-on-pink/80 text-sm font-bold mb-2">Lawan</p>
                )}
                <p className="font-display text-3xl font-black text-on-pink tabular-nums">{opponentScore}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRematch}
              disabled={
                rematchButtonState === 'inviting' ||
                rematchButtonState === 'locked' ||
                rematchButtonState === 'opponent_offline'
              }
              className={`btn-primary w-full text-base py-4 ${
                rematchButtonState === 'locked' ||
                rematchButtonState === 'opponent_offline'
                  ? 'opacity-50'
                  : ''
              }`}
            >
              {rematchButtonState === 'inviting' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menunggu jawaban… {inviteRemainingSec}s
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" /> Tantang Lagi
                </>
              )}
            </button>
            {rematchButtonState === 'locked' && (
              <p className="text-muted text-xs mt-2 text-center">{lockedSubtitle}</p>
            )}
            {rematchButtonState === 'opponent_offline' && (
              <p className="text-muted text-xs mt-2 text-center">Lawan offline</p>
            )}

            <button onClick={handleGoHome} className="btn-secondary w-full !py-3">
              <Home className="w-4 h-4" /> Beranda
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── Countdown ───────────────────────────────────────────────
  if (status === 'countdown' && countdown !== null && countdown >= 0) {
    const labelMap: Record<number, string> = { 0: 'GO!', 1: '1', 2: '2', 3: '3' };
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-paper">
        <ToastList toasts={toasts} />
        <div className="text-center space-y-4">
          <p className="badge"><Sparkles className="w-3 h-3" /> Bersiap…</p>
          <div key={countdown} className="countdown-number">
            <span className="font-display text-[10rem] md:text-[14rem] font-black leading-none bg-accent-gradient bg-clip-text text-transparent">
              {labelMap[countdown] ?? countdown}
            </span>
          </div>
          {countdown === 0 && (
            <p className="text-feedback-correct-text font-display text-xl font-extrabold animate-fade-in">
              Mulai!
            </p>
          )}
        </div>
      </main>
    );
  }

  // ─── Duel ────────────────────────────────────────────────────
  if (status === 'playing' && currentQuestion) {
    const opt = currentQuestion.options;

    return (
      <main className="min-h-screen flex flex-col bg-paper">
        <ToastList toasts={toasts} />
        {/* Top score bar */}
        <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur border-b border-rule-2 shadow-xs">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            {/* Me */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`shrink-0 w-9 h-9 rounded-xl ${AVATAR_CARDS[0]} ${AVATAR_TEXT[0]} flex items-center justify-center font-display font-extrabold text-sm`}>
                {playerName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold truncate">{playerName}</p>
                <p className="font-display text-lg font-black text-ink leading-none tabular-nums">{myScore}</p>
              </div>
            </div>

            {/* Center: progress dots */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1 text-[10px] text-muted font-semibold">
                <Clock className="w-3 h-3" /> {qIndex + 1}/{totalQuestions}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalQuestions }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i < qIndex ? 'bg-accent-violet'
                      : i === qIndex ? 'bg-accent-pink w-3'
                      : 'bg-rule'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Opponent */}
            <div className="flex items-center gap-2.5 min-w-0 flex-row-reverse">
              <span className={`shrink-0 w-9 h-9 rounded-xl ${AVATAR_CARDS[1]} ${AVATAR_TEXT[1]} flex items-center justify-center font-display font-extrabold text-sm`}>
                {(opponent?.name || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted font-semibold truncate">
                  {opponent?.name || '…'}
                </p>
                <p className="font-display text-lg font-black text-ink leading-none tabular-nums">{opponentScore}</p>
              </div>
            </div>
          </div>

          {/* Timer bar */}
          <div className="h-1.5 bg-paper-2">
            <div
              className={`h-full timer-bar ${timerBgClass}`}
              style={{ width: `${timerWidth}%` }}
            />
          </div>
        </div>

        {/* Question + options */}
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
          <div className="card animate-fade-in space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-accent-violet" />
              <span className="text-[11px] font-bold text-muted tracking-wider uppercase">
                Soal {qIndex + 1} dari {totalQuestions}
              </span>
            </div>
            <h2 className="font-display text-xl md:text-2xl font-extrabold text-ink leading-snug">
              {currentQuestion.question}
            </h2>
          </div>

          <div className="space-y-2.5">
            {opt.map((text, index) => {
              const isSelected   = selectedAnswer === index;
              const isCorrectHL  = showAnswerFeedback && correctAnswer === index;
              const isWrongHL    = showAnswerFeedback && isSelected && answerState === 'wrong';
              const isFaded      = showAnswerFeedback && !isCorrectHL && !isWrongHL;
              const isDisabled   = selectedAnswer !== null;

              const stateClass =
                isCorrectHL ? 'is-correct' :
                isWrongHL   ? 'is-wrong animate-shake' :
                isSelected  ? 'is-selected' :
                isFaded     ? 'is-faded' : '';

              const letterColor =
                isCorrectHL ? 'bg-feedback-correct text-white' :
                isWrongHL   ? 'bg-feedback-wrong text-white' :
                isSelected  ? 'bg-accent-gradient text-white' :
                'bg-card-purple text-on-purple';

              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  disabled={isDisabled}
                  className={`option-card ${stateClass} flex items-center gap-3.5`}
                >
                  <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-display font-extrabold text-sm transition-colors ${letterColor}`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 text-sm md:text-base font-semibold text-ink text-left leading-snug">
                    {text.replace(/^[A-D]\.\s*/, '')}
                  </span>
                  {isCorrectHL && <Check className="w-5 h-5 text-feedback-correct-text shrink-0" strokeWidth={3} />}
                  {isWrongHL && <span className="text-feedback-wrong-text text-xl shrink-0">✕</span>}
                </button>
              );
            })}
          </div>

          {/* Wait state */}
          {selectedAnswer !== null && !showAnswerFeedback && (
            <div className="text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-card-blue text-on-blue text-sm font-semibold">
                <span className="w-3 h-3 border-2 border-on-blue/30 border-t-on-blue rounded-full animate-spin" />
                Menunggu lawan menjawab…
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ─── Topic Select (post-rematch, pre-countdown) ──────────────
  // Both players already accepted; this is the bridge between match #N-1's
  // result screen and match #N's countdown. Host picks topic; guest waits.
  // Clean slate per spec — no scores from previous match shown here.
  if (status === 'topic_select') {
    const fallbackTopic = lastTopic || roomData?.topic || 'Umum';
    const fallbackQuestionCount = lastQuestionCount || roomData?.questionCount || 5;

    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 md:py-12">
        <ToastList toasts={toasts} />
        <div className="max-w-md w-full space-y-7 animate-fade-in">

          {/* Brand strip */}
          <div className="flex items-center justify-center">
            <div className="nav-pill !shadow-sm">
              <span className="w-6 h-6 rounded-md bg-accent-gradient flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </span>
              <span className="font-display text-sm font-extrabold text-ink">Match Baru</span>
            </div>
          </div>

          {/* Avatars (no scores — clean slate per spec) */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-bold text-muted tracking-wider uppercase flex items-center justify-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Pemain
            </h3>
            {players.map((p, i) => {
              const isMe = p.id === playerId;
              const isHostRow = p.id === roomData?.hostId;
              const card = AVATAR_CARDS[i % AVATAR_CARDS.length];
              const text = AVATAR_TEXT[i % AVATAR_TEXT.length];
              return (
                <div
                  key={p.id}
                  className={`card flex items-center gap-3 !p-3 !shadow-sm
                    ${isMe ? 'border-2 !border-accent-violet/40' : ''}
                    ${p.connected === false ? 'opacity-60' : ''}`}
                >
                  <div className={`w-11 h-11 rounded-xl ${card} flex items-center justify-center font-display font-extrabold text-base ${text}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate flex items-center gap-1.5">
                      {p.name}
                      {isMe && <span className="text-muted text-xs font-medium">(Kamu)</span>}
                    </p>
                    <p className="text-xs text-muted flex items-center gap-1">
                      {p.connected === false
                        ? <>⏳ Reconnecting…</>
                        : isHostRow
                          ? <><Crown className="w-3 h-3 text-accent-pink" /> Host</>
                          : 'Pemain'}
                    </p>
                  </div>
                  {p.connected !== false && (
                    <span className="w-2.5 h-2.5 rounded-full bg-feedback-correct animate-pulse-soft" />
                  )}
                </div>
              );
            })}
          </div>

          {isHost ? (
            opponent?.connected === false ? (
              // Slice 05: gate the TopicPicker while opponent is in the 60s
              // reconnect window. The server validates `players.every(connected)`
              // on `rematch_start` anyway, but rendering a disabled picker
              // would let the host generate questions only to have the
              // submission rejected — better to surface the wait state
              // directly. If opponent comes back, the picker mounts fresh
              // pre-filled with lastTopic/lastQuestionCount.
              <div className="card card-blue !p-7 text-center animate-fade-in space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/60 animate-pulse-soft">
                  <Sparkles className="w-6 h-6 text-on-blue" strokeWidth={2.2} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-extrabold text-on-blue">
                    Menunggu lawan kembali online…
                  </h3>
                  <p className="text-on-blue/70 text-xs">
                    Pemilihan topik akan tersedia saat lawan reconnect.
                  </p>
                </div>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-accent-violet animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <TopicPicker
                submitLabel="Mulai Duel"
                initialTopic={fallbackTopic}
                initialQuestionCount={fallbackQuestionCount}
                onSubmit={handleRematchStart}
              />
            )
          ) : (
            <div className="card card-purple !p-7 text-center animate-fade-in space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/60 animate-pulse-soft">
                <Sparkles className="w-6 h-6 text-on-purple" strokeWidth={2.2} />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-extrabold text-on-purple">
                  Host sedang memilih topik baru…
                </h3>
                <p className="text-on-purple/70 text-xs">
                  Topik terakhir: <strong>{fallbackTopic}</strong>
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-accent-violet animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ─── Lobby (default) ────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 md:py-12">
      <ToastList toasts={toasts} />
      <div className="max-w-md w-full space-y-7 animate-fade-in">

        {/* Brand strip */}
        <div className="flex items-center justify-center">
          <div className="nav-pill !shadow-sm">
            <span className="w-6 h-6 rounded-md bg-accent-gradient flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </span>
            <span className="font-display text-sm font-extrabold text-ink">Lobby Duel</span>
          </div>
        </div>

        {/* Topic + room code */}
        <div className="text-center space-y-3">
          <span className="badge"><Sparkles className="w-3 h-3" /> Topik</span>
          <h1 className="font-display text-2xl md:text-3xl font-black text-ink leading-tight">
            {roomData?.topic || 'Memuat…'}
          </h1>
        </div>

        {/* Room code card */}
        <div className="card text-center !p-6 space-y-3">
          <p className="text-[11px] font-bold text-muted tracking-wider uppercase">Kode Room</p>
          <p className="room-code-display text-5xl md:text-6xl">
            {roomId}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={handleCopyCode}
              className="btn-secondary !py-2 !px-4 !text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-feedback-correct-text" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Tersalin' : 'Salin Kode'}
            </button>
            <button
              onClick={handleCopyLink}
              className="btn-secondary !py-2 !px-4 !text-xs"
            >
              <Copy className="w-3.5 h-3.5" /> Salin Link
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold text-muted tracking-wider uppercase flex items-center justify-center gap-2">
            <Users className="w-3.5 h-3.5" />
            Pemain ({players.length}/2)
          </h3>

          <div className="space-y-2.5">
            {players.map((p, i) => {
              const isMe   = p.id === playerId;
              const isHostRow = p.id === roomData?.hostId || (isHost && isMe);
              const card   = AVATAR_CARDS[i % AVATAR_CARDS.length];
              const text   = AVATAR_TEXT[i % AVATAR_TEXT.length];
              return (
                <div
                  key={p.id}
                  className={`card flex items-center gap-3 !p-3 !shadow-sm
                    ${isMe ? 'border-2 !border-accent-violet/40' : ''}
                    ${p.connected === false ? 'opacity-60' : ''}
                    animate-slide-up`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className={`w-11 h-11 rounded-xl ${card} flex items-center justify-center font-display font-extrabold text-base ${text}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate flex items-center gap-1.5">
                      {p.name}
                      {isMe && <span className="text-muted text-xs font-medium">(Kamu)</span>}
                    </p>
                    <p className="text-xs text-muted flex items-center gap-1">
                      {p.connected === false
                        ? <>⏳ Reconnecting…</>
                        : isHostRow
                          ? <><Crown className="w-3 h-3 text-accent-pink" /> Host</>
                          : 'Pemain'}
                    </p>
                  </div>
                  {p.connected !== false && (
                    <span className="w-2.5 h-2.5 rounded-full bg-feedback-correct animate-pulse-soft" />
                  )}
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: 2 - players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3 border-2 border-dashed border-rule"
              >
                <div className="w-11 h-11 rounded-xl bg-paper-2 flex items-center justify-center text-muted text-lg font-bold">
                  ?
                </div>
                <p className="text-sm text-muted italic">Menunggu pemain…</p>
              </div>
            ))}
          </div>
        </div>

        {/* Start button or wait */}
        {isHost ? (
          <button
            onClick={handleStartDuel}
            disabled={players.length < 2}
            className="btn-primary w-full text-base py-4"
          >
            {players.length < 2 ? (
              <><Users className="w-5 h-5" /> Menunggu pemain…</>
            ) : (
              <><Zap className="w-5 h-5" /> Mulai Duel <Trophy className="w-4 h-4" /></>
            )}
          </button>
        ) : (
          <div className="card card-blue !p-4 text-center">
            <div className="inline-flex items-center gap-2 text-on-blue text-sm font-semibold">
              <span className="w-3 h-3 border-2 border-on-blue/30 border-t-on-blue rounded-full animate-spin" />
              Menunggu host memulai duel…
            </div>
          </div>
        )}

        {/* Leave */}
        <button
          onClick={() => { disconnectSocket(); router.push('/'); }}
          className="block mx-auto text-sm text-muted hover:text-ink transition-colors font-medium"
        >
          ← Tinggalkan room
        </button>
      </div>

      {/*
        Hallmark · macrostructure: Game state-machine (Lobby/Countdown/Duel/Result)
        genre: playful · theme: Pastel locked-by-spec
        states verified: lobby · countdown · playing (pending/correct/wrong/faded/disabled)
        · finished (winner/loser variants) · disconnect/reconnect/error
        contrast: pass (46–50)
      */}
    </main>
  );
}
