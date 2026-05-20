'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Zap, Loader2, Brain, ArrowRight } from 'lucide-react';
import { getSocket } from '@/lib/socket';

const POPULAR_TOPICS = [
  { label: 'Sains',          card: 'card-mint'   },
  { label: 'Matematika',     card: 'card-blue'   },
  { label: 'Sejarah',        card: 'card-amber'  },
  { label: 'Teknologi',      card: 'card-purple' },
  { label: 'Geografi',       card: 'card-mint'   },
  { label: 'Bahasa Inggris', card: 'card-pink'   },
  { label: 'Olahraga',       card: 'card-blue'   },
  { label: 'Musik',          card: 'card-purple' },
  { label: 'Film',           card: 'card-pink'   },
  { label: 'Makanan',        card: 'card-amber'  },
];

const QUESTION_COUNTS = [5, 10, 15];

export default function CreatePage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('kilascerdas_player_name');
    const pid = localStorage.getItem('kilascerdas_player_id');
    if (stored) setPlayerName(stored);
    else {
      const name = 'Player_' + Math.random().toString(36).substring(2, 6);
      setPlayerName(name);
      localStorage.setItem('kilascerdas_player_name', name);
    }
    if (pid) setPlayerId(pid);
    else {
      const newPid = 'player_' + Math.random().toString(36).substring(2, 10);
      setPlayerId(newPid);
      localStorage.setItem('kilascerdas_player_id', newPid);
    }
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) { setError('Masukkan topik terlebih dahulu'); return; }
    setError('');
    setIsGenerating(true);

    try {
      const res = await fetch('/api/generate-soal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), questionCount }),
      });
      const data = await res.json();

      if (!data.success || !data.questions?.length) {
        setError('Gagal generate soal. Coba lagi.');
        setIsGenerating(false);
        return;
      }

      const socket = getSocket();
      socket.on('room_created', (roomData) => {
        localStorage.setItem('kilascerdas_player_name', playerName);
        localStorage.setItem('kilascerdas_player_id', roomData.playerId);
        socket.off('room_created');
        router.push(`/room/${roomData.roomId}`);
      });

      socket.emit('create_room', {
        topic: topic.trim(),
        questionCount,
        questions: data.questions,
        playerName,
      });

      setTimeout(() => {
        setIsGenerating(false);
        setError('Timeout membuat room. Coba lagi.');
      }, 10000);
    } catch {
      setError('Gagal terhubung ke server. Coba lagi.');
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <header className="px-4 pt-6">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-rule shadow-sm hover:border-accent-violet hover:-translate-y-0.5 transition-all"
            aria-label="Kembali ke beranda"
          >
            <ArrowLeft className="w-4 h-4 text-ink" />
          </button>
          <div className="nav-pill !shadow-sm">
            <span className="w-6 h-6 rounded-md bg-accent-gradient flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </span>
            <span className="font-display text-sm font-extrabold text-ink">Buat Room</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-10 space-y-8 w-full flex-1">

        {/* ── Heading ── */}
        <div className="animate-fade-in space-y-2">
          <span className="badge"><Sparkles className="w-3 h-3" /> Atur Duel</span>
          <h1 className="font-display text-3xl md:text-4xl font-black text-ink tracking-tight leading-tight">
            Topik kamu, soal kami.
          </h1>
          <p className="text-muted text-sm md:text-base">
            Pilih topik dan jumlah soal — Gemini AI akan men-generate soal pilihan ganda yang segar.
          </p>
        </div>

        {/* ── Form ── */}
        <div className="space-y-7 animate-slide-up">

          {/* Topic input */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-muted tracking-wider uppercase">
              Topik Duel
            </label>
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => { setTopic(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="Contoh: Sains, Sejarah Indonesia, K-pop…"
                className="input pr-12 text-base"
                disabled={isGenerating}
              />
              <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-violet pointer-events-none" />
            </div>

            {/* Topic chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {POPULAR_TOPICS.map(({ label, card }) => {
                const active = topic === label;
                return (
                  <button
                    key={label}
                    onClick={() => { setTopic(label); setError(''); }}
                    disabled={isGenerating}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all
                      ${active
                        ? 'bg-accent-gradient text-white shadow-glow ring-2 ring-accent-violet/30'
                        : `${card} text-ink hover:-translate-y-0.5 hover:shadow-sm border border-transparent`
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question count */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-muted tracking-wider uppercase">
              Jumlah Soal
            </label>
            <div className="grid grid-cols-3 gap-3">
              {QUESTION_COUNTS.map((n) => {
                const active = questionCount === n;
                return (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    disabled={isGenerating}
                    className={`relative py-5 rounded-2xl font-display font-extrabold text-2xl transition-all border-2
                      ${active
                        ? 'bg-card-purple border-accent-violet text-on-purple shadow-md -translate-y-0.5'
                        : 'bg-surface border-rule text-muted hover:border-accent-violet/40 hover:text-ink hover:shadow-sm'
                      }`}
                  >
                    {n}
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mt-1 ${active ? 'text-on-purple/70' : 'text-muted'}`}>
                      soal
                    </span>
                    {active && (
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent-gradient flex items-center justify-center text-white text-xs shadow-glow">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-feedback-wrong-bg border border-feedback-wrong/30 rounded-xl px-4 py-3">
              <p className="text-feedback-wrong-text text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* ── State panel ── */}
        {isGenerating ? (
          <div className="animate-fade-in card card-purple text-center !p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/60 mb-4 animate-pulse-soft">
              <Sparkles className="w-7 h-7 text-on-purple" strokeWidth={2.2} />
            </div>
            <h3 className="font-display text-lg font-extrabold text-on-purple mb-1">
              Gemini AI sedang berpikir…
            </h3>
            <p className="text-muted text-sm mb-5">
              Membuat <strong>{questionCount}</strong> soal tentang <strong>“{topic}”</strong>
            </p>
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-accent-violet animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="card card-amber !p-7 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/60 mb-3">
              <Zap className="w-6 h-6 text-on-amber" strokeWidth={2.2} />
            </div>
            <h3 className="font-display text-base font-extrabold text-on-amber mb-1">
              Siap duel?
            </h3>
            <p className="text-xs text-muted">
              Klik tombol di bawah dan kami akan generate soalnya.
            </p>
          </div>
        )}

        {/* ── Sticky CTA ── */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !topic.trim()}
          className="btn-primary w-full text-base py-4"
        >
          {isGenerating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Memproses…</>
          ) : (
            <><Sparkles className="w-5 h-5" /> Generate Soal & Buat Room <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>

      {/*
        Hallmark · macrostructure: Workbench · genre: playful
        nav: N5 floating-pill back-button · footer: omitted (utility page)
        theme: Pastel locked-by-spec
        contrast: pass (46–50)
      */}
    </main>
  );
}
