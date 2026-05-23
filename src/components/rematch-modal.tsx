'use client';

import { useEffect, useState } from 'react';
import { Zap, Check } from 'lucide-react';

// ─── Rematch Modal ─────────────────────────────────────────────
// Invitation modal shown to the *target* of a rematch invite.
// Slice 03: happy path only. Backdrop is intentionally NOT click-to-close
// and ESC does NOT close — the only resolutions are Terima / Tolak / server
// timeout (which closes the modal externally via `rematch_resolved`).
//
// Pattern reused from homepage name modal (src/app/page.tsx:53-84):
//   bg-paper/85 backdrop-blur-sm + card max-w-sm + animate-scale-in.

interface Props {
  inviterName: string;
  lastTopic: string;
  /** Absolute epoch ms when the invite expires (server-driven). */
  expiresAt: number;
  onAccept: () => void;
  onDecline: () => void;
}

const TOTAL_MS = 10000;

export default function RematchModal({
  inviterName,
  lastTopic,
  expiresAt,
  onAccept,
  onDecline,
}: Props) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, expiresAt - Date.now())
  );

  // Live tick at 100ms for smooth progress bar; integer seconds for label.
  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, expiresAt - Date.now()));
    }, 100);
    return () => clearInterval(id);
  }, [expiresAt]);

  const remainingSec = Math.ceil(remainingMs / 1000);
  const progressPct = Math.max(0, Math.min(100, (remainingMs / TOTAL_MS) * 100));
  const expired = remainingMs <= 0;

  // Match the duel-screen timer urgency pattern: safe → warn → urgent.
  const barClass =
    progressPct < 30 ? 'bg-urgent' :
    progressPct < 60 ? 'bg-accent-pink' :
    'bg-accent-violet';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 backdrop-blur-sm px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rematch-modal-title"
    >
      <div className="card max-w-sm w-full text-center animate-scale-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-accent-pink border-[3px] border-ink shadow-sm flex items-center justify-center mb-4">
          <Zap className="w-7 h-7 text-ink" strokeWidth={2.5} />
        </div>

        <h2
          id="rematch-modal-title"
          className="font-display text-xl font-extrabold text-ink mb-1 leading-tight"
        >
          <span className="text-accent-violet">
            {inviterName}
          </span>{' '}
          mengajak tantang lagi
        </h2>

        <p className="text-muted text-sm mb-5">
          Topik terakhir: <strong className="text-ink">{lastTopic}</strong>
        </p>

        {/* Countdown progress bar — animates 100% → 0% over 10s. */}
        <div className="mb-5 space-y-1.5">
          <div className="h-2.5 rounded-full bg-paper-2 border-[2px] border-ink overflow-hidden">
            <div
              className={`h-full ${barClass} transition-[width,background-color] duration-100 ease-linear`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[11px] font-black text-ink tabular-nums tracking-wider uppercase">
            {expired ? 'Waktu habis…' : `Sisa ${remainingSec}s`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onDecline}
            disabled={expired}
            className="btn-secondary w-full !py-3"
          >
            Tolak
          </button>
          <button
            onClick={onAccept}
            disabled={expired}
            className="btn-primary w-full !py-3"
          >
            <Check className="w-4 h-4" /> Terima
          </button>
        </div>
      </div>
    </div>
  );
}
