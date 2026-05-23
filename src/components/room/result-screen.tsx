'use client';

import { RefreshCw, Loader2 } from 'lucide-react';
import type { Player } from '@/lib/types';
import type { RoomData } from '@/hooks/use-game-socket';
import type { DuelEndPayload } from '@/lib/socket-events';
import type { RematchInvite } from '@/lib/types';
import type { Toast } from '@/components/toast';
import { useRef, useEffect } from 'react';
import { createConfetti } from '@/lib/confetti';
import RematchModal from '@/components/rematch-modal';
import { RoomShell, RoomShellHeader, RoomShellFooter } from '@/components/room/room-shell';

interface Props {
  result: DuelEndPayload;
  playerId: string;
  playerName: string;
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
  result, playerId, playerName, opponent,
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

  const isDraw = result.winner === null;
  const isWinner = !isDraw && result.winner?.id === playerId;
  const opponentOffline = opponent ? opponent.connected === false : false;

  // ── Win/lose SFX (one-shot) ──
  // Plays once when the result screen mounts. Skipped only on draw.
  // Independent of the background-music toggle — that overlay controls
  // ONLY the looping backsound, not result SFX.
  useEffect(() => {
    if (isDraw) return;
    if (typeof window === 'undefined') return;

    const src = isWinner ? '/sounds/confetti.mp3' : '/sounds/losing-horn.mp3';
    const sfx = new Audio(src);
    sfx.volume = isWinner ? 0.55 : 0.5;
    sfx.play().catch(() => {
      // Autoplay rejected — silent fallback. Result screen is reached after
      // user interaction (answering questions), so this is an edge case.
    });

    return () => {
      sfx.pause();
      sfx.src = '';
    };
  }, [isDraw, isWinner]);

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
    <RoomShell toasts={toasts} confettiCanvasRef={confettiCanvasRef}>
      {rematchButtonState === 'incoming' && rematchInvite && (
        <RematchModal
          inviterName={rematchInvite.inviterName || 'Lawan'}
          lastTopic={roomData?.topic || result.topic || 'Umum'}
          expiresAt={rematchInvite.expiresAt}
          onAccept={onAcceptRematch}
          onDecline={onDeclineRematch}
        />
      )}

      <RoomShellHeader pillLabel="Hasil Duel" backLabel="Keluar" onBack={onGoHome} />

      <div className="flex-1 max-w-md w-full flex flex-col justify-center gap-8 z-10 py-6">
        <div className="text-center space-y-3">
          <div className={`mx-auto w-24 h-24 rounded-3xl flex items-center justify-center text-5xl border-3 border-ink relative
            ${isDraw ? 'bg-card-blue animate-fade-in' : isWinner ? 'bg-card-amber animate-bounce-in' : 'bg-card-mint animate-fade-in'}`}>
            {isDraw ? '🤝' : isWinner ? '🏆' : '💪'}
            <div className="absolute -top-3.5 -right-3 badge bg-white text-ink border-3 border-ink font-black text-[9px] tracking-wider px-2 py-1 rotate-[8deg]">
              {isDraw ? 'SERI' : isWinner ? 'JUARA' : 'BERJUANG'}
            </div>
          </div>

          <h1 className="font-display text-3xl font-black text-ink leading-none tracking-tight">
            {isDraw ? 'Hasil Seri!' : isWinner ? 'Kamu Menang!' : `${result.winner?.name || 'Lawan'} Menang`}
          </h1>
          <p className="text-ink-body font-black text-sm pt-2">
            {isDraw
              ? 'Skor sama kuat — duel ulang yuk! 🤝'
              : isWinner
                ? 'Kemampuan berpikirmu luar biasa! 🎉'
                : 'Pertarungan sengit! Teruslah berlatih.'}
          </p>
        </div>

        <div className="card border-3 border-ink bg-white p-6 space-y-4">
          <h3 className="text-base font-black text-ink tracking-widest uppercase text-center mb-6">
            Skor
          </h3>

          <div className="grid grid-cols-2 gap-4 items-stretch relative">
            <div className={`card border-3 border-ink !p-5 flex flex-col justify-between items-center text-center
              ${isDraw ? 'bg-card-blue text-on-blue' : isWinner ? 'bg-card-purple text-on-purple' : 'bg-card-pink text-on-pink'}`}>
              <p className="text-xs font-black uppercase tracking-wider">Kamu</p>
              <p className="font-display text-lg font-black truncate max-w-full my-1">{playerName || 'Kamu'}</p>
              <p className="font-display text-3xl font-black tabular-nums">{myScore}</p>
            </div>

            <div className={`card border-3 border-ink !p-5 flex flex-col justify-between items-center text-center
              ${isDraw ? 'bg-card-blue text-on-blue' : !isWinner ? 'bg-card-purple text-on-purple' : 'bg-card-pink text-on-pink'}`}>
              <p className="text-xs font-black uppercase tracking-wider">Lawan</p>
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
            className={`btn-primary w-full text-base py-4 border-3 border-ink font-black ${
              rematchButtonState === 'locked' ||
              rematchButtonState === 'opponent_offline'
                ? 'opacity-50'
                : ''
            }`}
          >
            {rematchButtonState === 'inviting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Menunggu Lawan… {inviteRemainingSec}s
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Tantang Lagi
              </>
            )}
          </button>

          {rematchButtonState === 'locked' && (
            <p className="text-peach text-xs font-black text-center animate-pulse">{lockedSubtitle}</p>
          )}
          {rematchButtonState === 'opponent_offline' && (
            <p className="text-ink-body text-xs font-black text-center">Lawan telah offline</p>
          )}
        </div>
      </div>

      <RoomShellFooter />
    </RoomShell>
  );
}
