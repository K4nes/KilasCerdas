import { useState, useEffect, useRef } from 'react';

type TimerColor = 'safe' | 'warn' | 'urgent';

export function useTimer(
  timeLimit: number,
  key: string | number,
  offsetMs: number = 0,
  paused: boolean = false,
): { width: number; bgClass: string } {
  const [width, setWidth] = useState(100);
  const [color, setColor] = useState<TimerColor>('safe');
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;

    const initialWidth = Math.max(0, 100 - (offsetMs / timeLimit) * 100);
    setWidth(initialWidth);
    setColor(initialWidth < 30 ? 'urgent' : initialWidth < 60 ? 'warn' : 'safe');
    startRef.current = Date.now() - offsetMs;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / timeLimit) * 100);
      setWidth(remaining);
      if (remaining < 30) setColor('urgent');
      else if (remaining < 60) setColor('warn');
      else setColor('safe');
      if (elapsed >= timeLimit && timerRef.current) clearInterval(timerRef.current);
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLimit, key, offsetMs, paused]);

  const bgClass =
    color === 'urgent' ? 'bg-urgent'
    : color === 'warn' ? 'bg-accent-pink'
    : 'bg-accent-violet';

  return { width, bgClass };
}
