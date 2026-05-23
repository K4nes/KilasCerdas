'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Users, Sparkles, Gamepad2, ArrowRight, Brain, Wifi, Lock, Wand2 } from 'lucide-react';

/* ───────────────────────────── STICKER ART (Tier-A CSS/SVG) ───────────────────────────── */

const BrainSparkMascot = ({ className = '' }: { className?: string }) => (
  <div className={`inline-flex shrink-0 ${className}`} style={{ animation: 'float 3.2s ease-in-out infinite' }}>
    <svg className="w-full h-full select-none filter drop-shadow-[3px_3px_0_var(--color-ink)]" viewBox="0 0 100 100" fill="none">
      {/* Left hemisphere — scalloped top reads as cerebral cortex */}
      <path
        d="M50 26
           C 46 18 38 18 36 24
           C 32 18 24 20 24 28
           C 18 30 18 40 24 44
           C 18 48 20 58 28 58
           C 26 68 36 76 46 74
           L 50 74 Z"
        fill="var(--color-card-pink)"
        stroke="var(--color-ink)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Right hemisphere — mirror */}
      <path
        d="M50 26
           C 54 18 62 18 64 24
           C 68 18 76 20 76 28
           C 82 30 82 40 76 44
           C 82 48 80 58 72 58
           C 74 68 64 76 54 74
           L 50 74 Z"
        fill="var(--color-card-mint)"
        stroke="var(--color-ink)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Centre seam */}
      <line x1="50" y1="26" x2="50" y2="74" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
      {/* Left folds — three squiggles, top to bottom */}
      <path d="M32 30 Q 40 34 35 40" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28 42 Q 38 46 32 52" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M34 56 Q 42 60 38 66" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Right folds — three squiggles, mirror */}
      <path d="M68 30 Q 60 34 65 40" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M72 42 Q 62 46 68 52" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M66 56 Q 58 60 62 66" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </div>
);

const SparkSticker = ({ className = '' }: { className?: string }) => (
  <div className={`inline-flex shrink-0 ${className}`} style={{ animation: 'float 4s ease-in-out infinite' }}>
    <svg className="w-full h-full select-none filter drop-shadow-[2px_2px_0_var(--color-ink)]" viewBox="0 0 100 100" fill="none">
      <path d="M50 10L58 35L85 25L70 50L90 68L62 68L68 90L50 75L32 90L38 68L10 68L30 50L15 25L42 35L50 10Z" fill="var(--color-accent-pink)" stroke="var(--color-ink)" strokeWidth="4" />
    </svg>
  </div>
);

/* ───────────────────────────── PAGE ───────────────────────────── */

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
      setPlayerName('Player_' + Math.random().toString(36).substring(2, 6));
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

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setShowNameModal(true);
      return;
    }
    localStorage.setItem('kilascerdas_player_name', playerName);
    router.push('/create');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-paper relative overflow-x-clip">

      {/* ── First-visit name modal ── */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 backdrop-blur-sm px-4 animate-fade-in">
          <div className="card max-w-sm w-full text-center p-8 relative animate-scale-in">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2">
              <BrainSparkMascot className="w-20 h-20" />
            </div>
            <div className="pt-6">
              <h2 className="font-display text-2xl font-black text-ink mb-1">
                Siapa nama kamu?
              </h2>
              <p className="text-ink-2 text-sm font-bold mb-6">
                Nama ini akan terlihat oleh lawan duelmu
              </p>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                placeholder="Tulis nama kamu…"
                className="input mb-5 text-center font-black text-lg"
                maxLength={20}
                autoFocus
              />
              <button
                onClick={saveName}
                disabled={!playerName.trim()}
                className="btn-primary w-full py-3.5 text-base"
              >
                <Sparkles className="w-4 h-4" />
                Mulai Duel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────── NAV — N6 bordered cap ───────── */}
      <header className="border-b-[3px] border-ink bg-paper/90 backdrop-blur-sm z-20 sticky top-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-lg bg-accent-pink border-[3px] border-ink shadow-xs flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-ink" strokeWidth={3} />
            </div>
            <span className="font-display text-base sm:text-lg font-black text-ink tracking-tight truncate">
              KILAS&nbsp;CERDAS
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[3px] border-ink bg-card-mint text-on-mint text-[11px] font-black uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-correct animate-pulse-soft" />
            Live · Powered by Gemini
          </span>
        </div>
      </header>

      {/* ───────── BENTO GRID ───────── */}
      <section className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-8 sm:py-12 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 auto-rows-min">

        {/* Tile 1 · HERO — span 8, row-span 2 */}
        <article className="card md:col-span-8 md:row-span-2 relative p-7 sm:p-10 flex flex-col justify-between min-h-[24rem]">
          {/* Spark sticker overlay — spills OUTSIDE the card boundary */}
          <div
            aria-hidden="true"
            className="absolute -top-7 -right-7 sm:-top-8 sm:-right-8 w-24 h-24 sm:w-28 sm:h-28 z-20 pointer-events-none"
          >
            <SparkSticker className="w-full h-full" />
          </div>

          <div className="space-y-5 relative z-10">
            <span className="badge bg-card-amber text-on-amber border-[3px] border-ink">
              Duel 1v1 · Real-time
            </span>

            <h1
              className="font-display font-black text-ink tracking-tight leading-[0.92]"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 4.25rem)', overflowWrap: 'anywhere', minWidth: 0 }}
            >
              Duel Seru,<br />
              <span className="relative inline-block">
                Adu Cerdas
                <svg
                  className="absolute -bottom-1 left-0 w-full h-4"
                  viewBox="0 0 200 14"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 9 C 30 4, 70 11, 105 7 S 170 9, 195 5"
                    fill="none"
                    stroke="url(#hero-underline)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="hero-underline" x1="0" x2="1">
                      <stop offset="0%" stopColor="var(--color-accent-pink)" />
                      <stop offset="100%" stopColor="var(--color-accent-violet)" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>

            <p className="text-ink-2 font-bold text-base sm:text-lg max-w-lg leading-relaxed">
              Pilih topik, bagikan kode, lalu adu wawasan secara real-time dengan teman.
            </p>
          </div>
        </article>

        {/* Tile 2 · ACTION — span 4, row-span 2 */}
        <article className="card md:col-span-4 md:row-span-2 p-6 sm:p-7 flex flex-col gap-5 bg-surface relative">
          <div className="absolute -top-3.5 right-5 badge bg-accent-pink text-ink border-[3px] border-ink">
            <Gamepad2 className="w-3.5 h-3.5" />
            Mulai sekarang
          </div>

          <div className="pt-2">
            <label className="text-[11px] font-black text-ink uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5" /> Nama Pemain
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                localStorage.setItem('kilascerdas_player_name', e.target.value);
              }}
              placeholder="Nama kamu"
              className="input font-black"
              maxLength={20}
            />
          </div>

          <button
            onClick={handleCreateRoom}
            className="btn-primary w-full py-3.5 text-base"
          >
            <Zap className="w-5 h-5" strokeWidth={3} />
            Buat Room Duel
            <ArrowRight className="w-4 h-4" strokeWidth={3} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t-[3px] border-ink border-dashed" />
            <span className="text-ink text-[10px] font-black tracking-widest uppercase shrink-0">atau gabung</span>
            <div className="flex-1 border-t-[3px] border-ink border-dashed" />
          </div>

          <div className="space-y-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                  setJoinError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                placeholder="KODE"
                className="input flex-1 min-w-0 text-center font-display text-base font-black tracking-[0.25em] uppercase"
                maxLength={6}
                aria-label="Kode room"
              />
              <button
                onClick={handleJoinRoom}
                className="btn-secondary !rounded-xl !px-5 shrink-0 bg-card-mint hover:bg-card-mint"
              >
                Masuk
              </button>
            </div>

            {joinError && (
              <p
                role="alert"
                className="text-wrong text-xs text-center font-black bg-wrong-bg/10 border-[3px] border-wrong py-1.5 rounded-xl"
              >
                {joinError}
              </p>
            )}
          </div>
        </article>

        {/* Tile 3 · TOPICS — span 5 */}
        <article className="card card-purple md:col-span-5 p-5 sm:p-6 flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-base sm:text-lg font-black text-on-purple uppercase tracking-tight">
              Topik tersedia
            </h3>
            <Wand2 className="w-5 h-5 text-on-purple shrink-0" strokeWidth={3} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Sejarah', cls: 'bg-card-pink text-on-pink' },
              { label: 'Sains', cls: 'bg-card-mint text-on-mint' },
              { label: 'Bahasa', cls: 'bg-card-amber text-on-amber' },
              { label: 'Teknologi', cls: 'bg-card-blue text-on-blue' },
              { label: 'Geografi', cls: 'bg-card-pink text-on-pink' },
              { label: 'Apa saja…', cls: 'bg-surface text-ink' },
            ].map((t) => (
              <span
                key={t.label}
                className={`inline-flex items-center px-3 py-1.5 rounded-full border-[3px] border-ink font-display font-black text-xs sm:text-sm ${t.cls}`}
              >
                {t.label}
              </span>
            ))}
          </div>
          <p className="text-on-purple/80 text-xs font-bold leading-relaxed pt-1">
            Atau ketik topik sendiri — Gemini bikin soalnya.
          </p>
        </article>

        {/* Tile 4 · HOW IT WORKS — span 4 */}
        <article className="card card-amber md:col-span-4 p-5 sm:p-6">
          <h3 className="font-display text-base sm:text-lg font-black text-on-amber uppercase tracking-tight mb-6">
            Cara main
          </h3>
          <ol className="space-y-3">
            {[
              'Pilih topik & jumlah soal',
              'Bagikan kode 6-digit ke teman',
              'Adu jawaban — siapa cepat & tepat menang',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-surface border-[3px] border-ink font-display font-black text-sm text-ink flex items-center justify-center shadow-xs">
                  {i + 1}
                </span>
                <span className="text-on-amber text-sm font-bold leading-snug pt-0.5">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </article>

        {/* Tile 5 · STAT / GEMINI — span 3 */}
        <article className="card card-mint md:col-span-3 p-5 sm:p-6 flex flex-col justify-between gap-3">
          <Sparkles className="w-7 h-7 text-on-mint" strokeWidth={2.5} />
          <div>
            <p className="font-display font-black text-on-mint leading-none" style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)' }}>
              AI
            </p>
            <p className="text-on-mint text-xs font-black uppercase tracking-widest mt-1.5">
              Soal real-time
            </p>
          </div>
          <p className="text-on-mint/80 text-xs font-bold leading-snug">
            Tiap duel, soal baru. Gak ada bank soal yang ngulang.
          </p>
        </article>

        {/* Tile 6 · LIVE — span 6 */}
        <article className="card md:col-span-6 p-5 sm:p-6 flex items-center gap-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-card-pink border-[3px] border-ink flex items-center justify-center shadow-xs">
            <Wifi className="w-6 h-6 text-on-pink" strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm sm:text-base font-black text-ink uppercase tracking-tight">
              Sinkron real-time
            </h3>
            <p className="text-ink-2 text-xs sm:text-sm font-bold leading-snug mt-0.5">
              Timer, skor, dan jawaban tersinkron via WebSocket. Gak ada lag.
            </p>
          </div>
        </article>

        {/* Tile 7 · PRIVACY — span 6 */}
        <article className="card md:col-span-6 p-5 sm:p-6 flex items-center gap-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-card-blue border-[3px] border-ink flex items-center justify-center shadow-xs">
            <Lock className="w-6 h-6 text-on-blue" strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm sm:text-base font-black text-ink uppercase tracking-tight">
              Tanpa login, tanpa iklan
            </h3>
            <p className="text-ink-2 text-xs sm:text-sm font-bold leading-snug mt-0.5">
              Cuma butuh nama dan kode. Data nggak disimpan.
            </p>
          </div>
        </article>

        {/* Tile 8 · CLOSING STATEMENT — span 12 (footer folded into bento) */}
        <article className="card card-purple md:col-span-12 p-7 sm:p-10 flex flex-col gap-7 relative">
          {/* Mascot spills OUTSIDE the parent card — same treatment as hero spark */}
          <div
            aria-hidden="true"
            className="absolute bottom-14 -right-6 sm:bottom-16 sm:-right-10 w-28 h-28 sm:w-36 sm:h-36 z-20 pointer-events-none"
            style={{ transform: 'rotate(-12deg)' }}
          >
            <BrainSparkMascot className="w-full h-full" />
          </div>

          <p
            className="font-display font-black text-on-purple leading-[0.95] tracking-tight max-w-2xl relative z-10"
            style={{ fontSize: 'clamp(1.75rem, 5vw, 3.25rem)', overflowWrap: 'anywhere', minWidth: 0 }}
          >
            Belajar bisa seru.<br />
            <span className="text-accent-pink">Tinggal cari lawan.</span>
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 border-t-[3px] border-ink border-dashed relative z-10">
            <span className="text-on-purple text-xs font-black tracking-widest uppercase">
              © 2026 Kilas Cerdas
            </span>
            <span className="text-on-purple text-xs font-black tracking-widest uppercase inline-flex items-center gap-1.5">
              Made with
              <Sparkles className="w-3.5 h-3.5 text-accent-pink" />
              by Antigravity
            </span>
          </div>
        </article>

      </section>

      {/*
        Hallmark · macrostructure: Bento Grid
        theme: Matcha Berry (spec-locked) · genre: playful
        nav: N6 bordered cap · footer: folded into bento (closing tile, span 12)
        enrichment: Tier-A CSS-art stickers + handwritten SVG underline
        diversification: differs from previous home (Workbench Layout / N5 / Ft8)
        contrast: pass · responsive: 320 / 375 / 414 / 768 verified
      */}
    </main>
  );
}
