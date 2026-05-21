'use client';

interface Props {
  countdown: number;
}

export default function CountdownScreen({ countdown }: Props) {
  const labelMap: Record<number, string> = { 0: 'GO!', 1: '1', 2: '2', 3: '3' };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-paper relative">
      <div className="text-center space-y-6">
        <div className="sticker-bubble border-2 border-rule animate-bounce-in text-5xl px-8 py-4">
          <span>Bersiaplah Untuk Duel!</span>
        </div>

        <div key={countdown} className="countdown-number">
          <span className="font-display text-[10rem] md:text-[14rem] font-black leading-none bg-accent-gradient bg-clip-text text-transparent">
            {labelMap[countdown] ?? countdown}
          </span>
        </div>

        {countdown === 0 && (
          <p className="text-feedback-correct-text font-display text-2xl font-black tracking-widest animate-fade-in uppercase">
            Mulai!
          </p>
        )}
      </div>
    </main>
  );
}
