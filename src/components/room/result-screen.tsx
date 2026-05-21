'use client';

import { ArrowLeft, RefreshCw, Loader2, Swords, Sparkles } from 'lucide-react';
import type { Player } from '@/lib/types';
import type { RoomData } from '@/hooks/use-game-socket';
import type { DuelEndPayload } from '@/lib/socket-events';
import type { RematchInvite } from '@/lib/types';
import type { Toast } from '@/components/toast';
import { ToastList } from '@/components/toast';
import { useRef, useEffect } from 'react';
import { createConfetti } from '@/lib/confetti';
import RematchModal from '@/components/rematch-modal';

interface Props {
  result: DuelEndPayload;
  playerId: string;
  playerName: string;
  players: Player[];
  opponent: Player | undefined;
  myScore: number;
  opponentScore: number;
  roomData: RoomData | null;
  toasts: Toast[];
  confettiCanvasRef: React.RefObject<HTMLCanvasElement>;
  rematchInvite: RematchInvite | null;
  inviteRemainingMs: number;
  myRematchLocked: boolean;
  lastInviteRole: 'inviter' | 'target' | null;
  onRematch: () => void;
  onAcceptRematch: () => void;
  onDeclineRematch: () => void;
  onGoHome: () => void;
}

export default function ResultScreen({
  result, playerId, playerName, players, opponent,
  myScore, opponentScore, roomData, toasts,
  confettiCanvasRef,
  rematchInvite, inviteRemainingMs, myRematchLocked, lastInviteRole,
  onRematch, onAcceptRematch, onDeclineRematch, onGoHome,
}: Props) {
  const stopConfettiRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (confettiCanvasRef.current) {
        stopConfettiRef.current = createConfetti(confettiCanvasRef.current);
      }
    });
    return () => {
      if (stopConfettiRef.current) stopConfettiRef.current();
    };
  }, [confettiCanvasRef]);

  const isWinner = result.winner?.id === playerId;
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
  const lockedSubtitle =
    lastInviteRole === 'inviter' ? 'Lawan menolak' : 'Rematch ditolak';

  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-8 bg-paper relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
        <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-purple blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-pink blur-[120px]" />
      </div>

      <ToastList toasts={toasts} />
      <canvas ref={confettiCanvasRef} id="confetti-canvas" className="absolute inset-0 pointer-events-none z-0" />

      {rematchButtonState === 'incoming' && rematchInvite && (
        <RematchModal
          inviterName={rematchInvite.inviterName || 'Lawan'}
          lastTopic={roomData?.topic || result.topic || 'Umum'}
          expiresAt={rematchInvite.expiresAt}
          onAccept={onAcceptRematch}
          onDecline={onDeclineRematch}
        />
      )}

      <header className="w-full max-w-xl mx-auto flex justify-between items-center z-10 pt-2">
        <button
          onClick={onGoHome}
          className="btn-secondary !rounded-xl !px-4 !py-2 border-2 border-rule bg-white flex items-center gap-2 shadow-sm font-bold text-xs uppercase hover:-translate-y-0.5 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
          Keluar
        </button>
        <div className="nav-pill border-2 border-rule shadow-sm bg-white py-1 px-3">
          <span className="font-display text-[10px] font-black text-ink tracking-widest uppercase">
            Hasil Duel
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-md w-full flex flex-col justify-center gap-8 z-10 py-6">
        <div className="text-center space-y-3">
          <div className={`mx-auto w-24 h-24 rounded-3xl flex items-center justify-center text-5xl border-3 border-ink relative
            ${isWinner ? 'bg-card-amber animate-bounce-in' : 'bg-card-blue animate-fade-in'}`}>
            {isWinner ? '🏆' : '💪'}
            <div className="absolute -top-3.5 -right-3 badge bg-white text-ink border-2 border-ink font-black text-[9px] tracking-wider px-2 py-0.5 rotate-[8deg]">
              {isWinner ? 'JUARA' : 'BERJUANG'}
            </div>
          </div>

          <h1 className="font-display text-3xl font-black text-ink leading-none tracking-tight">
            {isWinner ? 'Kamu Menang!' : `${result.winner?.name || 'Lawan'} Menang`}
          </h1>
          <p className="text-ink font-bold text-xs pt-2">
            {isWinner ? 'Kemampuan berpikirmu luar biasa! 🎉' : 'Pertarungan sengit! Teruslah berlatih.'}
          </p>
        </div>

        <div className="card border-3 border-ink shadow-md bg-white p-5 space-y-4">
          <h3 className="text-base font-black text-ink tracking-widest uppercase text-center p-4">
            Podium Skor
          </h3>

          <div className="grid grid-cols-2 gap-4 items-stretch relative">
            <div className={`card border-2 border-rule !p-4 !shadow-xs flex flex-col justify-between items-center text-center
              ${isWinner ? 'bg-card-purple text-on-purple' : 'bg-card-pink text-on-pink'}`}>
              <p className="text-xs font-black uppercase tracking-wider opacity-65">Kamu</p>
              <p className="font-display text-lg font-black truncate max-w-full my-1">{playerName || 'Kamu'}</p>
              <p className="font-display text-3xl font-black tabular-nums">{myScore}</p>
            </div>

            <div className={`card border-2 border-rule !p-4 !shadow-xs flex flex-col justify-between items-center text-center
              ${!isWinner ? 'bg-card-purple text-on-purple' : 'bg-card-pink text-on-pink'}`}>
              <p className="text-xs font-black uppercase tracking-wider opacity-65">Lawan</p>
              <p className="font-display text-lg font-black truncate max-w-full my-1">{opponent?.name || 'Anonymous'}</p>
              <p className="font-display text-3xl font-black tabular-nums">{opponentScore}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onRematch}
            disabled={
              rematchButtonState === 'inviting' ||
              rematchButtonState === 'locked' ||
              rematchButtonState === 'opponent_offline'
            }
            className={`w-full text-base py-4 bg-accent-violet hover:bg-accent-violet/90 disabled:bg-muted disabled:cursor-not-allowed disabled:transform-none text-white font-bold rounded-full transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 border-2 border-ink ${
              rematchButtonState === 'locked' ||
              rematchButtonState === 'opponent_offline'
                ? 'opacity-50'
                : ''
            }`}
          >
            {rematchButtonState === 'inviting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                Menunggu Lawan… {inviteRemainingSec}s
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 text-white" />
                Tantang Lagi
              </>
            )}
          </button>

          {rematchButtonState === 'locked' && (
            <p className="text-feedback-wrong-text text-xs font-bold text-center animate-pulse">{lockedSubtitle}</p>
          )}
          {rematchButtonState === 'opponent_offline' && (
            <p className="text-muted text-xs font-bold text-center">Lawan telah offline</p>
          )}
        </div>
      </div>

      <footer className="w-full max-w-xl mx-auto text-center text-muted text-[9px] font-bold z-10">
        <span>© 2026 KILAS CERDAS</span>
      </footer>
    </main>
  );
}
