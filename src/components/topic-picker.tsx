'use client';

import { useState } from 'react';
import { Sparkles, Zap, Loader2, ArrowRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

type Props = {
  initialTopic?: string;
  initialQuestionCount?: number;
  /** Label for the submit CTA, e.g. "Generate Soal & Buat Room" or "Mulai Duel". */
  submitLabel: string;
  /**
   * Called after `/api/generate-soal` responds successfully. Parent decides what
   * to do with the generated questions (emit `create_room`, `rematch_start`, …).
   *
   * If `onSubmit` returns a Promise, the loading state is held until it settles
   * — that lets parents preserve a single end-to-end loading UX across an
   * async hand-off (socket round-trip, etc.). If it rejects with an Error, the
   * error message is shown inline and loading is cleared.
   */
  onSubmit: (topic: string, questions: GeneratedQuestion[]) => void | Promise<void>;
};

// ─── Constants ────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────

export default function TopicPicker({
  initialTopic = '',
  initialQuestionCount = 5,
  submitLabel,
  onSubmit,
}: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const [questionCount, setQuestionCount] = useState(initialQuestionCount);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Masukkan topik terlebih dahulu');
      return;
    }
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

      // Hand off. Await regardless — if parent returns void this resolves
      // immediately; if parent returns a Promise we keep the loading state
      // until it settles so end-to-end UX stays cohesive.
      //
      // Note: we intentionally do NOT clear `isGenerating` on the success
      // path. The parent is expected to navigate away or take over the
      // loading UX. If the parent wants to surface an error and clear
      // loading, it should reject with an Error.
      await onSubmit(topic.trim(), data.questions as GeneratedQuestion[]);
    } catch (err) {
      const msg = err instanceof Error && err.message
        ? err.message
        : 'Gagal terhubung ke server. Coba lagi.';
      setError(msg);
      setIsGenerating(false);
    }
  };

  return (
    <>
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
          <><Sparkles className="w-5 h-5" /> {submitLabel} <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
    </>
  );
}
