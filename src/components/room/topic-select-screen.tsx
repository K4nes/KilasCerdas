'use client';

import { Crown, Sparkles, Swords } from 'lucide-react';
import type { Player } from '@/lib/types';
import type { RoomData } from '@/hooks/use-game-socket';
import { AVATAR_CARDS, AVATAR_TEXT } from '@/hooks/use-game-socket';
import { ToastList, type Toast } from '@/components/toast';
import TopicPicker, { type GeneratedQuestion } from '@/components/topic-picker';

interface Props {
  players: Player[];
  playerId: string;
  roomData: RoomData | null;
  opponent: Player | undefined;
  isHost: boolean;
  lastTopic: string;
  lastQuestionCount: number;
  toasts: Toast[];
  onRematchStart: (topic: string, questions: GeneratedQuestion[]) => Promise<void>;
}

export default function TopicSelectScreen({
  players, playerId, roomData, opponent,
  isHost, lastTopic, lastQuestionCount,
  toasts, onRematchStart,
}: Props) {
  const fallbackTopic = lastTopic || roomData?.topic || 'Umum';
  const fallbackQuestionCount = lastQuestionCount || roomData?.questionCount || 5;

  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-8 bg-paper relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
        <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-mint blur-[120px]" />
        <div className="absolute bottom-[20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-purple blur-[120px]" />
      </div>

      <ToastList toasts={toasts} />

      <header className="w-full max-w-md mx-auto flex justify-center items-center z-10 pt-2">
        <div className="nav-pill border-2 border-rule shadow-sm bg-white py-1 px-3">
          <span className="font-display text-[10px] font-black text-ink tracking-widest uppercase">
            Ronde Baru
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-md w-full flex flex-col justify-center gap-10 z-10 py-6">
        <div className="text-center space-y-2">
          <div className="sticker-bubble border-2 border-rule animate-bounce-in flex items-center justify-center gap-1.5 mx-auto">
            <Swords className="w-4 h-4 text-accent-pink" />
            <span>Rematch Terbentuk!</span>
          </div>
          <h1 className="font-display text-2xl font-black text-ink leading-tight pt-1">
            Topik Pertarungan
          </h1>
        </div>

        <div className="space-y-2">
          {players.map((p, i) => {
            const isMe = p.id === playerId;
            const isHostRow = p.id === roomData?.hostId;
            const card = AVATAR_CARDS[i % AVATAR_CARDS.length];
            const text = AVATAR_TEXT[i % AVATAR_TEXT.length];
            return (
              <div
                key={p.id}
                className={`card flex items-center gap-3 !p-3 !shadow-xs border-2
                  ${isMe ? 'border-accent-violet bg-white' : 'border-rule bg-white/70'}
                  ${p.connected === false ? 'opacity-60' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl ${card} flex items-center justify-center font-display font-extrabold text-sm ${text} border border-rule/50`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-sm text-ink truncate flex items-center gap-1.5">
                    {p.name}
                    {isMe && <span className="text-muted text-[10px] font-bold uppercase">(Kamu)</span>}
                  </p>
                  <p className="text-[10px] text-muted font-bold uppercase flex items-center gap-1">
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
            <div className="card card-blue border-2 border-rule !p-6 text-center animate-fade-in space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/60 animate-pulse-soft">
                <Sparkles className="w-5 h-5 text-on-blue" strokeWidth={2.2} />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-sm font-black text-on-blue uppercase">
                  Menunggu Lawan Kembali…
                </h3>
                <p className="text-on-blue/70 text-xs font-semibold">
                  Pemilihan topik akan terbuka setelah lawan terhubung kembali.
                </p>
              </div>
            </div>
          ) : (
            <div className="card border-3 border-ink shadow-lg bg-white p-5 space-y-4 animate-scale-in">
              <TopicPicker
                submitLabel="Mulai Duel"
                initialTopic={fallbackTopic}
                initialQuestionCount={fallbackQuestionCount}
                onSubmit={onRematchStart}
              />
            </div>
          )
        ) : (
          <div className="card card-purple border-2 border-rule !p-6 text-center animate-fade-in space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/60 animate-pulse-soft">
              <Sparkles className="w-5 h-5 text-on-purple" strokeWidth={2.2} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-sm font-black text-on-purple uppercase">
                Host Memilih Topik…
              </h3>
              <p className="text-on-purple/70 text-xs font-semibold">
                Mempersiapkan duel ronde berikutnya.
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="w-full max-w-md mx-auto text-center text-muted text-[9px] font-bold z-10">
        <span>© 2026 KILAS CERDAS</span>
      </footer>
    </main>
  );
}
