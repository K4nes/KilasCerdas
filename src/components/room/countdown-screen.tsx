'use client';

import { useEffect, useRef } from 'react';

interface Props {
  countdown: number;
}

/**
 * Procedurally synthesise a short beep using the Web Audio API.
 * No external assets, no API key, no network — just an oscillator
 * with an attack/decay envelope to avoid the click of a hard cut.
 *
 *  3, 2, 1 → 880 Hz, 120 ms, square-ish (urgent tick)
 *  0 (GO!) → 1320 Hz, 320 ms, sine     (clean release tone)
 */
function playBeep(ctx: AudioContext, freq: number, durationMs: number, type: OscillatorType, peak: number) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  // Envelope: 8ms attack → exponential decay over duration. Exponential
  // ramp avoids the audible click that linear ramps produce on cut.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export default function CountdownScreen({ countdown }: Props) {
  const labelMap: Record<number, string> = { 0: 'GO!', 1: '1', 2: '2', 3: '3' };
  const ctxRef = useRef<AudioContext | null>(null);

  // Lazy-init AudioContext. By the time this screen mounts the user has
  // already clicked "Start Duel" so the gesture requirement is satisfied.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctxRef.current = new AC();

    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  // Fire one beep per countdown tick.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    if (countdown === 0) {
      playBeep(ctx, 1320, 320, 'sine', 0.18);   // GO! — release
    } else if (countdown >= 1 && countdown <= 3) {
      playBeep(ctx, 880, 120, 'square', 0.12);  // tick
    }
  }, [countdown]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-paper relative">
      <div className="text-center space-y-8">
        <div className="sticker-bubble border-3 border-ink animate-bounce-in text-xl px-6 py-3 font-black uppercase tracking-wider">
          <span>Bersiaplah Untuk Duel!</span>
        </div>

        <div key={countdown} className="countdown-number">
          <span className="font-display text-[10rem] md:text-[14rem] font-black leading-none text-accent-pink"
            style={{ textShadow: '5px 5px 0 var(--color-ink)' }}>
            {labelMap[countdown] ?? countdown}
          </span>
        </div>

        {countdown === 0 && (
          <p className="text-emerald font-display text-2xl font-black tracking-widest animate-fade-in uppercase">
            Mulai!
          </p>
        )}
      </div>
    </main>
  );
}
