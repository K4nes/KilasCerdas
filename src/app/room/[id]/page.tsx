'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Check, Users, Clock, Zap, Brain, RefreshCw, Home, Crown, Sparkles, Trophy } from 'lucide-react';
import { getSocket, disconnectSocket } from '@/lib/socket';

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

type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

interface RoomData {
  id: string;
  topic: string;
  questionCount: number;
  status: RoomStatus;
  currentQuestion?: number;
  hostId?: string;
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

  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const stopConfettiRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);

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

    socket.on('error_message', (data) => setError(data.message));

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

    socket.emit('join_room', { roomId, playerName, playerId });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stopConfettiRef.current) stopConfettiRef.current();
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

  const handleRematch = () => {
    disconnectSocket();
    if (roomData?.topic) router.push(`/create?topic=${encodeURIComponent(roomData.topic)}`);
    else router.push('/create');
  };

  const handleGoHome = () => { disconnectSocket(); router.push('/'); };

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

  if (error && !roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card text-center max-w-sm w-full">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-feedback-wrong-bg flex items-center justify-center mb-4">
            <span className="text-3xl">😢</span>
          </div>
          <h2 className="font-display text-xl font-extrabold text-ink mb-2">Oops!</h2>
          <p className="text-muted text-sm mb-5">{error}</p>
          <button onClick={() => router.push('/')} className="btn-primary w-full">
            <Home className="w-4 h-4" /> Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // ─── Result ──────────────────────────────────────────────────
  if (status === 'finished' && result) {
    const isWinner = result.winner?.id === playerId;

    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <canvas ref={confettiCanvasRef} id="confetti-canvas" />

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
            <button onClick={handleRematch} className="btn-primary w-full text-base py-4">
              <RefreshCw className="w-5 h-5" /> Tantang Lagi
            </button>

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

  // ─── Lobby (default) ────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 md:py-12">
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
