'use client';

import { ArrowLeft, Copy, Check, Users, Crown, Zap, Trophy, Sparkles } from 'lucide-react';
import type { Player } from '@/lib/types';
import type { RoomData } from '@/hooks/use-game-socket';
import { AVATAR_CARDS, AVATAR_TEXT } from '@/hooks/use-game-socket';
import { ToastList, type Toast } from '@/components/toast';

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
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-8 bg-paper relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
        <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-purple blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-pink blur-[120px]" />
      </div>

      <ToastList toasts={toasts} />

      <header className="w-full max-w-xl mx-auto flex justify-between items-center z-10 pt-2">
        <button
          onClick={onGoHome}
          className="btn-secondary !rounded-xl !px-4 !py-2 border-2 border-rule bg-white flex items-center gap-2 shadow-sm font-bold text-xs uppercase hover:-translate-y-0.5 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
          Keluar
        </button>
        <div className="nav-pill border-2 border-rule shadow-sm bg-white py-1 px-3">
          <span className="font-display text-[10px] font-black text-ink tracking-widest uppercase">
            Lobby Duel
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-md w-full flex flex-col justify-center gap-6 z-10 py-6">
        <div className="text-center space-y-2">
          <div className="badge border border-rule"><Sparkles className="w-3 h-3 text-accent-pink" /> TOPIK DUEL</div>
          <h1 className="font-display text-2xl md:text-3xl font-black text-ink leading-tight tracking-tight">
            {roomData?.topic || 'Memuat…'}
          </h1>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-11 gap-2 items-center">
            <div className="col-span-5">
              {players[0] ? (
                <div className={`card border-2 border-ink !p-5 text-center bg-white shadow-sm flex flex-col items-center gap-2 relative
                  ${players[0].id === playerId ? 'border-accent-violet ring-2 ring-accent-violet/10' : ''}`}>
                  <span className={`w-16 h-16 rounded-3xl flex items-center justify-center font-display font-extrabold text-lg border border-rule/50 ${AVATAR_CARDS[0]} ${AVATAR_TEXT[0]}`}>
                    {players[0].name.charAt(0).toUpperCase()}
                  </span>
                  <p className="font-bold text-sm text-ink truncate max-w-full leading-none">{players[0].name}</p>
                  <span className="badge bg-card-purple text-on-purple border border-rule/45 text-[9px] px-2.5 py-1 uppercase tracking-wider flex items-center gap-1 font-black">
                    <Crown className="w-2.5 h-2.5 text-accent-pink fill-accent-pink" /> Host
                  </span>
                </div>
              ) : (
                <div className="card border-2 border-dashed border-rule !p-5 text-center bg-surface/40 flex flex-col items-center justify-center min-h-[140px]">
                  <p className="text-xl font-black text-muted">?</p>
                </div>
              )}
            </div>

            <div className="col-span-1 flex justify-center z-10">
              <div className="w-11 h-11 rounded-full bg-card-amber text-on-amber border-2 border-ink font-black text-xs flex items-center justify-center rotate-[-8deg] shadow-md shrink-0">
                VS
              </div>
            </div>

            <div className="col-span-5">
              {players[1] ? (
                <div className={`card border-2 border-ink !p-5 text-center bg-white shadow-sm flex flex-col items-center gap-2 relative
                  ${players[1].id === playerId ? 'border-accent-violet ring-2 ring-accent-violet/10' : ''}
                  ${players[1].connected === false ? 'opacity-60' : ''}`}>
                  <span className={`w-16 h-16 rounded-3xl flex items-center justify-center font-display font-extrabold text-lg border border-rule/50 ${AVATAR_CARDS[1]} ${AVATAR_TEXT[1]}`}>
                    {players[1].name.charAt(0).toUpperCase()}
                  </span>
                  <p className="font-bold text-sm text-ink truncate max-w-full leading-none">{players[1].name}</p>
                  <span className="badge bg-card-blue text-on-blue border border-rule/45 text-[9px] px-2.5 py-1 uppercase tracking-wider flex items-center gap-1 font-black">
                    {players[1].connected === false ? '⏳ AFK' : 'Ready'}
                  </span>
                </div>
              ) : (
                <div className="card border-2 border-dashed border-rule !p-5 text-center bg-surface/50 flex flex-col items-center justify-center min-h-[140px] animate-pulse">
                  <span className="w-14 h-14 rounded-2xl bg-paper-2 flex items-center justify-center text-muted font-bold text-base">?</span>
                  <p className="text-xs text-muted font-bold mt-1.5 uppercase tracking-wide">Waiting…</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card border-3 border-ink shadow-md bg-white p-5 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-lg font-black text-muted tracking-widest uppercase">Kode Room</p>
            <p className="room-code-display text-4xl font-black">{roomId}</p>
          </div>

          <button
            onClick={onCopyCode}
            className="btn-secondary w-full !py-2.5 !text-xs font-bold flex items-center justify-center gap-1.5 border-2 border-rule hover:border-ink"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-feedback-correct-text" strokeWidth={3} /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Tersalin' : 'Salin Kode'}
          </button>
        </div>

        <div className="w-full">
          {isHost ? (
            <button
              onClick={onStartDuel}
              disabled={players.length < 2}
              className="w-full text-base py-4 bg-accent-violet hover:bg-accent-violet/90 disabled:bg-muted disabled:cursor-not-allowed disabled:transform-none text-white font-bold rounded-full transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 border-2 border-ink"
            >
              {players.length < 2 ? (
                <><Users className="w-5 h-5" /> Menunggu Lawan…</>
              ) : (
                <><Zap className="w-5 h-5 text-white" /> Mulai Duel Sekarang <Trophy className="w-4 h-4 text-white" /></>
              )}
            </button>
          ) : (
            <div className="card card-blue border-2 border-rule !p-4 text-center shadow-xs">
              <div className="inline-flex items-center gap-2 text-on-blue text-xs font-black uppercase tracking-wider">
                <span className="w-3.5 h-3.5 border-2 border-on-blue/30 border-t-on-blue rounded-full animate-spin shrink-0" />
                Menunggu Host Memulai Duel…
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="w-full max-w-xl mx-auto text-center text-muted text-[9px] font-bold z-10">
        <span>© 2026 KILAS CERDAS</span>
      </footer>
    </main>
  );
}
