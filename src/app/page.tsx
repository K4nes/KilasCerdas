'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Users, BookOpen, Brain, Star, Sparkles, Trophy, ArrowRight, Gamepad2, ArrowRightLeft } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('kilascerdas_player_name');
    if (stored) {
      setPlayerName(stored);
    } else {
      setShowNameModal(true);
      const name = 'Player_' + Math.random().toString(36).substring(2, 6);
      setPlayerName(name);
    }
  }, []);

  const saveName = () => {
    if (!playerName.trim()) return;
    localStorage.setItem('kilascerdas_player_name', playerName.trim());
    setShowNameModal(false);
  };

  const handleJoinRoom = () => {
    const code = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) { setJoinError('Masukkan kode room'); return; }
    if (code.length < 6) { setJoinError('Kode room harus 6 karakter'); return; }
    if (!playerName.trim()) { setJoinError('Masukkan nama kamu'); return; }
    localStorage.setItem('kilascerdas_player_name', playerName);
    router.push(`/room/${code}`);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-between bg-paper relative overflow-hidden">
      {/* Background radial soft lights to fill the void with playful vibe */}
      <div className="absolute inset-0 pointer-events-none opacity-40 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-purple blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-pink blur-[120px]" />
      </div>

      {/* ── First-visit name modal ── */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 backdrop-blur-sm px-4 animate-fade-in">
          <div className="card max-w-sm w-full text-center border-2 border-rule shadow-lg animate-scale-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-card-amber flex items-center justify-center mb-4 border-2 border-rule">
              <Star className="w-7 h-7 text-on-amber" strokeWidth={2.5} />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-ink mb-1">
              Halo, siapa nama kamu?
            </h2>
            <p className="text-muted text-sm mb-5 font-semibold">
              Nama ini akan terlihat oleh lawan duelmu
            </p>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              placeholder="Tulis nama kamu…"
              className="input mb-4 text-center border-2 border-rule font-semibold text-lg"
              maxLength={20}
              autoFocus
            />
            <button
              onClick={saveName}
              disabled={!playerName.trim()}
              className="btn-primary w-full"
            >
              <Sparkles className="w-4 h-4" />
              Mulai
            </button>
          </div>
        </div>
      )}

      {/* ── Top nav pill ── */}
      <header className="px-4 pt-4 flex justify-center z-10">
        <div className="nav-pill border-2 border-rule shadow-sm bg-white flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-accent-gradient flex items-center justify-center shadow-sm">
            <Brain className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-sm font-black text-ink tracking-wide">
            KILAS CERDAS
          </span>
          <span className="hidden sm:flex items-center gap-1.5 pl-3 border-l-2 border-rule text-xs text-ink font-bold">
            <Sparkles className="w-3 h-3 text-accent-violet animate-pulse" />
            Powered by Gemini
          </span>
        </div>
      </header>

      {/* ── Hero Split Layout ── */}
      <section className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 md:py-16 grid grid-cols-1 md:grid-cols-12 gap-10 items-center z-10">
        {/* Left Column: Playful Hero Copy */}
        <div className="md:col-span-7 space-y-6 text-center md:text-left flex flex-col items-center md:items-start">
          <h1 className="font-display font-black text-ink tracking-tight leading-[0.95] text-[clamp(2.75rem,8vw,4.5rem)]">
            Duel Seru,{' '}
            <span className="relative inline-block">
              Adu Cerdas
              <svg
                className="absolute -bottom-2 left-0 w-full h-3"
                viewBox="0 0 200 10"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M2 7 Q 50 1, 100 5 T 198 4"
                  fill="none"
                  stroke="url(#u-redesign)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="u-redesign" x1="0" x2="1">
                    <stop offset="0%" stopColor="oklch(66% 0.22 0)" />
                    <stop offset="100%" stopColor="oklch(60% 0.22 295)" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h1>

          <p className="text-ink font-semibold text-lg md:text-xl max-w-xl leading-relaxed">
            Pilih topik kesukaanmu, bagikan kode ke teman, lalu adu wawasan secara instan! Soal unik di-generate secara real-time oleh Gemini AI.
          </p>
        </div>

        {/* Right Column: Workbench Action Lobby Card */}
        <div className="md:col-span-5 flex justify-center">
          <div className="card w-full max-w-md border-3 border-ink shadow-lg bg-white relative animate-scale-in">
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-extrabold text-ink flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-accent-violet" />
                  Mulai Pertarungan
                </h2>
                <p className="text-muted text-xs font-bold mt-1">
                  Atur namamu dan buat/gabung ke arena tanding
                </p>
              </div>

              {/* Player Name Input Field */}
              <div className="space-y-2">
                <label className="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted" /> Nama Pemain
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => {
                      setPlayerName(e.target.value);
                      localStorage.setItem('kilascerdas_player_name', e.target.value);
                    }}
                    placeholder="Nama kamu"
                    className="input border-2 border-rule font-bold text-ink"
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="border-t border-rule my-4" />

              {/* Action 1: Create Room */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    localStorage.setItem('kilascerdas_player_name', playerName);
                    router.push('/create');
                  }}
                  className="btn-primary w-full text-base py-3.5 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <Zap className="w-5 h-5 fill-white text-white" />
                  Buat Room Duel Baru
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Separator / Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-rule" />
                <span className="text-muted text-[10px] font-black tracking-widest uppercase">Atau Gabung Room</span>
                <div className="flex-1 border-t border-rule" />
              </div>

              {/* Action 2: Join Room with Code */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                      setJoinError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                    placeholder="KODE ROOM (6 DIGIT)"
                    className="input flex-1 text-center font-display text-lg font-black tracking-[0.2em] uppercase border-2 border-rule"
                    maxLength={6}
                  />
                  <button
                    onClick={handleJoinRoom}
                    className="btn-secondary font-black !rounded-xl !px-6 border-2 border-ink shrink-0 bg-card-mint text-on-mint hover:bg-card-mint/80 transition-colors"
                  >
                    Masuk
                  </button>
                </div>

                {joinError && (
                  <p className="text-feedback-wrong-text text-xs text-center font-bold animate-pulse">{joinError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Responsive feature sticker panels at bottom on mobile */}
      <footer className="w-full max-w-6xl mx-auto px-6 pb-6 pt-2 z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:hidden">
          <div className="card card-purple border-2 border-rule text-center py-3">
            <h3 className="text-xs font-black text-on-purple uppercase">🧠 AI Quiz</h3>
            <p className="text-xs text-on-purple/80 font-bold mt-0.5">Soal unik Gemini AI</p>
          </div>
          <div className="card card-pink border-2 border-rule text-center py-3">
            <h3 className="text-xs font-black text-on-pink uppercase">⚡ Duel PvP</h3>
            <p className="text-xs text-on-pink/80 font-bold mt-0.5">Sync timer & skor live</p>
          </div>
          <div className="card card-mint border-2 border-rule text-center py-3">
            <h3 className="text-xs font-black text-on-mint uppercase">🍀 Bebas Iklan</h3>
            <p className="text-xs text-on-mint/80 font-bold mt-0.5">Tanpa registrasi, instan</p>
          </div>
        </div>

        <div className="mt-4 border-t border-rule/60 pt-4 flex flex-col sm:flex-row items-center justify-between text-muted text-[10px] font-bold tracking-wider uppercase gap-2">
          <span>© 2026 KILAS CERDAS</span>
        </div>
      </footer>

      {/*
        Hallmark · macrostructure: Split Workbench Layout · tone: playful
        theme: studied-DNA (spec-locked pastel) · genre: playful
        contrast: pass (46–50) · H1 hero size: xl (≤ 7 words)
        nav: N5 floating-pill · footer: Ft8 minimal
      */}
    </main>
  );
}
