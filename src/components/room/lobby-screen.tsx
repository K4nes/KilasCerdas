'use client';

import { Copy, Check, Users, Crown, Zap, Trophy, Sparkles } from 'lucide-react';
import type { Player } from '@/lib/types';
import type { RoomData } from '@/hooks/use-game-socket';
import type { Toast } from '@/components/toast';
import { RoomShell, RoomShellHeader, RoomShellFooter } from '@/components/room/room-shell';
import { PlayerAvatar } from '@/components/room/player-avatar';

interface Props {
  players: Player[];
  roomData: RoomData | null;
  roomId: string;
  isHost: boolean;
  playerId: string;
  playerName: string;
  toasts: Toast[];
  copied: boolean;
  onCopyCode: () => void;
  onStartDuel: () => void;
  onGoHome: () => void;
}

export default function LobbyScreen({
  players, roomData, roomId, isHost, playerId, playerName,
  toasts, copied, onCopyCode, onStartDuel, onGoHome,
}: Props) {
  return (
    <RoomShell toasts={toasts}>
      <RoomShellHeader pillLabel="Lobby Duel" backLabel="Keluar" onBack={onGoHome} />

      <div className="flex-1 max-w-md w-full flex flex-col justify-center gap-8 z-10 py-6">
        <div className="text-center space-y-3">
          <div className="badge border-3 border-ink bg-card-mint text-on-mint px-3.5 py-1.5 font-black text-[10px] tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 text-accent-pink fill-accent-pink mr-1.5" />
            Topik Duel
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-black text-ink leading-tight tracking-tight">
            {roomData?.topic || 'Memuat…'}
          </h1>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-11 gap-4 sm:gap-5 items-center">
            <div className="col-span-5">
              {players[0] ? (
                <div className={`card border-3 border-ink !p-5 text-center bg-white flex flex-col items-center gap-2 relative shadow-sm
                  ${players[0].id === playerId ? '!border-accent-pink' : ''}`}>
                  <PlayerAvatar name={players[0].name} index={0} size="lg" />
                  <p className="font-black text-sm text-ink truncate max-w-full leading-none">{players[0].name}</p>
                  <span className="badge bg-card-purple text-on-purple border-3 border-ink text-[10px] px-3 py-1 uppercase tracking-wider flex items-center gap-1 font-black">
                    <Crown className="w-3 h-3 text-accent-pink fill-accent-pink" /> Host
                  </span>
                </div>
              ) : (
                <div className="card border-3 border-dashed border-ink !p-5 text-center bg-surface/40 flex flex-col items-center justify-center min-h-[140px]">
                  <p className="text-xl font-black text-muted">?</p>
                </div>
              )}
            </div>

            <div className="col-span-1 flex justify-center z-10">
              <div className="w-12 h-12 rounded-full bg-card-amber text-on-amber border-3 border-ink font-black text-sm flex items-center justify-center rotate-[-8deg] shadow-sm shrink-0">
                VS
              </div>
            </div>

            <div className="col-span-5">
              {players[1] ? (
                <div className={`card border-3 border-ink !p-5 text-center bg-white flex flex-col items-center gap-2 relative shadow-sm
                  ${players[1].id === playerId ? '!border-accent-pink' : ''}
                  ${players[1].connected === false ? 'opacity-60' : ''}`}>
                  <PlayerAvatar name={players[1].name} index={1} size="lg" />
                  <p className="font-black text-sm text-ink truncate max-w-full leading-none">{players[1].name}</p>
                  <span className="badge bg-card-blue text-on-blue border-3 border-ink text-[10px] px-3 py-1 uppercase tracking-wider flex items-center gap-1 font-black">
                    {players[1].connected === false ? '⏳ AFK' : 'Ready'}
                  </span>
                </div>
              ) : (
                <div className="card border-3 border-dashed border-ink !p-5 text-center bg-surface/50 flex flex-col items-center justify-center min-h-[140px] animate-pulse">
                  <span className="w-14 h-14 rounded-2xl bg-paper-2 flex items-center justify-center text-muted font-black text-base">?</span>
                  <p className="text-xs text-ink-body font-black mt-1.5 uppercase tracking-wide">Waiting…</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card border-3 border-ink bg-white p-6 space-y-5">
          <div className="text-center space-y-3">
            <p className="text-xs font-black text-ink-body tracking-widest uppercase">Kode Room</p>
            <div className="inline-flex items-center justify-center bg-card-amber border-[3px] border-ink rounded-2xl shadow-sm px-6 py-3">
              <p className="room-code-display text-4xl font-black leading-none">{roomId}</p>
            </div>
          </div>

          <button
            onClick={onCopyCode}
            className="btn-secondary w-full !py-3 !text-sm font-black flex items-center justify-center gap-2 border-3 border-ink hover:border-accent-pink"
          >
            {copied ? <Check className="w-4 h-4 text-emerald" strokeWidth={3} /> : <Copy className="w-4 h-4" />}
            {copied ? 'Tersalin' : 'Salin Kode'}
          </button>
        </div>

        <div className="w-full">
          {isHost ? (
            <button
              onClick={onStartDuel}
              disabled={players.length < 2}
              className="btn-primary w-full text-base py-4 border-3 border-ink shadow-sm"
            >
              {players.length < 2 ? (
                <><Users className="w-5 h-5" /> Menunggu Lawan…</>
              ) : (
                <><Zap className="w-5 h-5" /> Mulai Duel Sekarang <Trophy className="w-4 h-4" /></>
              )}
            </button>
          ) : (
            <div className="card card-mint border-3 border-ink !p-5 text-center shadow-sm">
              <div className="inline-flex items-center gap-2 text-on-mint text-xs font-black uppercase tracking-wider">
                <span className="w-4 h-4 border-3 border-on-mint/30 border-t-on-mint rounded-full animate-spin shrink-0" />
                Menunggu Host Memulai Duel…
              </div>
            </div>
          )}
        </div>
      </div>

      <RoomShellFooter />
    </RoomShell>
  );
}
