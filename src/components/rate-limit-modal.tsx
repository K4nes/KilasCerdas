'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';

// ─── Rate Limit Modal ──────────────────────────────────────────
// Shown when the Gemini API responds with HTTP 429. The free tier resets
// daily; the API also returns a per-burst retry-after window when quota is
// momentarily exceeded. We surface both in plain language plus a live
// countdown so the user knows when they can try again.
//
// Pattern reused from RematchModal (max-w-sm card, animate-scale-in,
// bg-paper/85 backdrop). No ESC / backdrop-close — user must dismiss
// explicitly so the message is acknowledged.

interface Props {
  retryAfterSec: number;
  onRetry: () => void;
  onClose: () => void;
}

export default function RateLimitModal({ retryAfterSec, onRetry, onClose }: Props) {
  const [remaining, setRemaining] = useState(retryAfterSec);

  useEffect(() => {
    setRemaining(retryAfterSec);
  }, [retryAfterSec]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const canRetry = remaining <= 0;

  // Format mm:ss when ≥ 60s, else plain seconds.
  const label =
    remaining >= 60
      ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
      : `${remaining}s`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 backdrop-blur-sm px-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-limit-modal-title"
    >
      <div className="card max-w-sm w-full text-center animate-scale-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-card-amber border-[3px] border-ink shadow-sm flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-on-amber" strokeWidth={2.5} />
        </div>

        <h2
          id="rate-limit-modal-title"
          className="font-display text-xl font-extrabold text-ink mb-2 leading-tight"
        >
          Kuota Soal Habis
        </h2>

        <p className="text-ink-2 text-sm font-bold mb-5 leading-relaxed">
          Server lagi sibuk membuat soal untuk pemain lain. Tunggu sebentar lalu
          coba lagi ya.
        </p>

        {/* Countdown panel */}
        <div className="card card-mint border-[3px] border-ink !p-4 mb-5">
          <div className="flex items-center justify-center gap-2 text-on-mint">
            <Clock className="w-4 h-4 shrink-0" strokeWidth={3} />
            <span className="text-[11px] font-black uppercase tracking-widest">
              {canRetry ? 'Siap Coba Lagi' : 'Coba Lagi Dalam'}
            </span>
          </div>
          <p className="font-display text-3xl font-black text-on-mint tabular-nums mt-1.5 leading-none">
            {canRetry ? '✓' : label}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="btn-secondary w-full !py-3"
          >
            Tutup
          </button>
          <button
            onClick={onRetry}
            disabled={!canRetry}
            className="btn-primary w-full !py-3"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={3} />
            Coba Lagi
          </button>
        </div>
      </div>
    </div>
  );
}
