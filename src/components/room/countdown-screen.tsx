'use client';

interface Props {
  countdown: number;
}

export default function CountdownScreen({ countdown }: Props) {
  const labelMap: Record<number, string> = { 0: 'GO!', 1: '1', 2: '2', 3: '3' };

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
