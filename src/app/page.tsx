'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Users, BookOpen, Brain, Star, Sparkles, Trophy, ArrowRight } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">

      {/* ── First-visit name modal ── */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 backdrop-blur-sm px-4 animate-fade-in">
          <div className="card max-w-sm w-full text-center animate-scale-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-card-amber flex items-center justify-center mb-4">
              <Star className="w-7 h-7 text-on-amber" strokeWidth={2.5} />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-ink mb-1">
              Halo, siapa nama kamu?
            </h2>
            <p className="text-muted text-sm mb-5">
              Nama ini akan terlihat oleh lawan duelmu
            </p>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              placeholder="Tulis nama kamu…"
              className="input mb-4 text-center"
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
      <header className="px-4 pt-6 flex justify-center">
        <div className="nav-pill">
          <span className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center shadow-glow">
            <Brain className="w-4 h-4 text-white" strokeWidth={2.5} />
          </span>
          <span className="font-display text-sm font-extrabold text-ink tracking-tight">
            Kilas Cerdas
          </span>
          <span className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-rule text-xs text-muted">
            <Sparkles className="w-3 h-3" />
            Powered by Gemini
          </span>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-10 md:py-16">
        <div className="max-w-xl w-full text-center space-y-8 animate-fade-in">

          {/* Hero copy */}
          <div className="space-y-5">
            <span className="badge animate-bounce-in">
              <Zap className="w-3 h-3" /> Duel Real-Time
            </span>

            <h1 className="font-display font-black text-ink tracking-tight leading-[0.95] text-[clamp(2.75rem,9vw,4.5rem)]">
              Duel Otak,{' '}
              <span className="relative inline-block">
                Soal AI
                <svg
                  className="absolute -bottom-1 left-0 w-full"
                  viewBox="0 0 200 10"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 7 Q 50 1, 100 5 T 198 4"
                    fill="none"
                    stroke="url(#u)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="u" x1="0" x2="1">
                      <stop offset="0%"   stopColor="oklch(66% 0.22 0)" />
                      <stop offset="100%" stopColor="oklch(60% 0.22 295)" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>

            <p className="text-muted text-base sm:text-lg max-w-md mx-auto leading-relaxed">
              Pilih topik, bagikan kode, lalu duel real-time melawan teman.
              Soal di-generate Gemini AI — fresh setiap pertarungan.
            </p>
          </div>

          {/* Primary CTA */}
          <div className="space-y-4 animate-slide-up">
            <button
              onClick={() => {
                localStorage.setItem('kilascerdas_player_name', playerName);
                router.push('/create');
              }}
              className="btn-primary w-full max-w-xs mx-auto text-base py-4"
            >
              <Zap className="w-5 h-5" />
              Buat Room Duel
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 max-w-xs mx-auto">
              <div className="flex-1 border-t border-rule" />
              <span className="text-muted text-xs font-semibold tracking-wider uppercase">atau gabung</span>
              <div className="flex-1 border-t border-rule" />
            </div>

            {/* Join form */}
            <div className="max-w-xs mx-auto space-y-3">
              <div className="card !p-1.5 !shadow-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-muted ml-3 shrink-0" />
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => {
                    setPlayerName(e.target.value);
                    localStorage.setItem('kilascerdas_player_name', e.target.value);
                  }}
                  placeholder="Nama kamu"
                  className="flex-1 bg-transparent text-ink py-2 outline-none text-sm placeholder:text-muted font-medium"
                  maxLength={20}
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                    setJoinError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  placeholder="ABC123"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="input flex-1 text-center font-display text-2xl font-extrabold tracking-[0.3em] uppercase !rounded-xl"
                  maxLength={6}
                />
                <button
                  onClick={handleJoinRoom}
                  className="btn-secondary !rounded-xl !px-5 shrink-0"
                >
                  Gabung
                </button>
              </div>

              {joinError && (
                <p className="text-feedback-wrong-text text-xs text-center font-medium">{joinError}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Feature row (5-card pastel) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl w-full mt-16 animate-fade-in">
          {[
            { Icon: Brain,    title: 'AI Soal',   desc: 'Soal unik tiap duel.',          card: 'card-purple', text: 'text-on-purple' },
            { Icon: Zap,      title: 'Real-time', desc: 'Sync timer & skor live.',       card: 'card-pink',   text: 'text-on-pink' },
            { Icon: Trophy,   title: 'Bonus Speed', desc: '< 3 detik = +50 poin.',       card: 'card-blue',   text: 'text-on-blue' },
            { Icon: BookOpen, title: 'Belajar',   desc: 'Belajar lewat kompetisi.',      card: 'card-mint',   text: 'text-on-mint' },
          ].map(({ Icon, title, desc, card, text }, i) => (
            <div
              key={i}
              className={`card ${card} text-center !shadow-sm`}
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/55 mb-3">
                <Icon className={`w-5 h-5 ${text}`} strokeWidth={2.2} />
              </div>
              <h3 className={`font-display text-sm font-bold ${text} mb-1`}>{title}</h3>
              <p className="text-xs text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center py-6 text-muted text-xs">
        <span className="font-medium">Kilas Cerdas</span>
        <span className="mx-2 opacity-50">·</span>
        Juara Vibe Coding 2026
        <span className="mx-2 opacity-50">·</span>
        Next.js + Socket.io + Gemini AI
      </footer>

      {/*
        Hallmark · macrostructure: Marquee Hero · genre: playful
        nav: N5 floating-pill · footer: Ft8 minimal
        theme: Pastel locked-by-spec (paper #faf5ff · pink→violet accent · Poppins)
        contrast: pass (46–50)
        diversification: differs from prior OATSIDE run on display style + accent hue
      */}
    </main>
  );
}
