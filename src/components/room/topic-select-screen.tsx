'use client';

import { Crown, Sparkles, Swords } from 'lucide-react';
import type { Player } from '@/lib/types';
import type { RoomData } from '@/hooks/use-game-socket';
import type { Toast } from '@/components/toast';
import TopicPicker, { type GeneratedQuestion } from '@/components/topic-picker';
import { RoomShell, RoomShellHeader, RoomShellFooter } from '@/components/room/room-shell';
import { PlayerAvatar } from '@/components/room/player-avatar';

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
  const chatId = roomData?.chatId;

  return (
    <RoomShell toasts={toasts}>
      <RoomShellHeader pillLabel="Ronde Baru" maxWidth="md" />

      <div className="flex-1 max-w-md w-full flex flex-col justify-center gap-10 z-10 py-6">
        <div className="text-center space-y-3">
          <div className="sticker-bubble border-3 border-ink animate-bounce-in flex items-center justify-center gap-1.5 mx-auto bg-card-pink text-on-pink py-2 px-4">
            <Swords className="w-4 h-4 text-ink" />
            <span className="font-black text-sm uppercase tracking-wider">Rematch Terbentuk!</span>
          </div>
          <h1 className="font-display text-2xl font-black text-ink leading-tight pt-1">
            Topik Pertarungan
          </h1>
        </div>

        <div className="space-y-2">
          {players.map((p, i) => {
            const isMe = p.id === playerId;
            const isHostRow = p.id === roomData?.hostId;
            return (
              <div
                key={p.id}
                className={`card flex items-center gap-3 !p-4 border-3 border-ink
                  ${isMe ? 'bg-white' : 'bg-white/70'}
                  ${p.connected === false ? 'opacity-60' : ''}`}
              >
                <PlayerAvatar name={p.name} index={i} size="md" as="div" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-black text-sm text-ink truncate flex items-center gap-1.5">
                    {p.name}
                    {isMe && <span className="text-ink-body text-[10px] font-black uppercase">(Kamu)</span>}
                  </p>
                  <p className="text-[10px] text-ink-body font-black uppercase flex items-center gap-1">
                    {p.connected === false
                      ? <>⏳ Reconnecting…</>
                      : isHostRow
                        ? <><Crown className="w-3 h-3 text-accent-pink" /> Host</>
                        : 'Pemain'}
                  </p>
                </div>
                {p.connected !== false && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald animate-pulse-soft" />
                )}
              </div>
            );
          })}
        </div>

        {isHost ? (
          opponent?.connected === false ? (
            <div className="card card-mint border-3 border-ink !p-6 text-center animate-fade-in space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border-3 border-ink animate-pulse-soft">
                <Sparkles className="w-6 h-6 text-on-mint" strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-sm font-black text-on-mint uppercase">
                  Menunggu Lawan Kembali…
                </h3>
                <p className="text-on-mint/70 text-xs font-bold">
                  Pemilihan topik akan terbuka setelah lawan terhubung kembali.
                </p>
              </div>
            </div>
          ) : (
            <div className="card border-[3px] border-ink bg-white p-6 space-y-4 animate-scale-in">
              <TopicPicker
                submitLabel="Mulai Duel"
                initialTopic={fallbackTopic}
                initialQuestionCount={fallbackQuestionCount}
                chatId={chatId}
                onSubmit={onRematchStart}
              />
            </div>
          )
        ) : (
          <div className="card card-purple border-3 border-ink !p-6 text-center animate-fade-in space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border-3 border-ink animate-pulse-soft">
              <Sparkles className="w-6 h-6 text-on-purple" strokeWidth={2.5} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-sm font-black text-on-purple uppercase">
                Host Memilih Topik…
              </h3>
              <p className="text-on-purple/70 text-xs font-bold">
                Mempersiapkan duel ronde berikutnya.
              </p>
            </div>
          </div>
        )}
      </div>

      <RoomShellFooter maxWidth="md" />
    </RoomShell>
  );
}
