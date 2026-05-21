'use client';

import { Clock, Check } from 'lucide-react';
import type { Player, Question } from '@/lib/types';
import { AVATAR_CARDS, AVATAR_TEXT } from '@/hooks/use-game-socket';

interface Props {
  currentQuestion: Question;
  qIndex: number;
  totalQuestions: number;
  playerName: string;
  myScore: number;
  opponent: Player | undefined;
  opponentScore: number;
  timerWidth: number;
  timerBgClass: string;
  selectedAnswer: number | null;
  answerState: 'pending' | 'correct' | 'wrong' | 'timeout';
  correctAnswer: number | null;
  showAnswerFeedback: boolean;
  onAnswer: (index: number) => void;
}

export default function DuelScreen({
  currentQuestion, qIndex, totalQuestions,
  playerName, myScore, opponent, opponentScore,
  timerWidth, timerBgClass,
  selectedAnswer, answerState, correctAnswer, showAnswerFeedback,
  onAnswer,
}: Props) {
  const opt = currentQuestion.options;

  return (
    <main className="min-h-screen flex flex-col bg-paper relative">
      <div className="sticky top-0 z-20 bg-surface border-b-2 border-ink shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`shrink-0 w-9 h-9 rounded-xl border-2 border-ink ${AVATAR_CARDS[0]} ${AVATAR_TEXT[0]} flex items-center justify-center font-display font-extrabold text-sm`}>
              {playerName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-ink font-black truncate">{playerName}</p>
              <p className="font-display text-lg font-black text-ink leading-none tabular-nums">{myScore}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 text-[10px] text-ink font-black uppercase">
              <Clock className="w-3.5 h-3.5 text-accent-violet" /> {qIndex + 1}/{totalQuestions}
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalQuestions }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full border border-ink transition-all ${
                    i < qIndex ? 'bg-accent-violet'
                    : i === qIndex ? 'bg-accent-pink w-4'
                    : 'bg-white'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 min-w-0 flex-row-reverse">
            <span className={`shrink-0 w-9 h-9 rounded-xl border-2 border-ink ${AVATAR_CARDS[1]} ${AVATAR_TEXT[1]} flex items-center justify-center font-display font-extrabold text-sm`}>
              {(opponent?.name || '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 text-right">
              <p className="text-[10px] uppercase tracking-wider text-ink font-black truncate">
                {opponent?.name || 'Lawan'}
              </p>
              <p className="font-display text-lg font-black text-ink leading-none tabular-nums">{opponentScore}</p>
            </div>
          </div>
        </div>

        <div className="h-2 bg-paper border-t border-ink/40">
          <div
            className={`h-full timer-bar ${timerBgClass}`}
            style={{ width: `${timerWidth}%` }}
          />
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="card border-3 border-ink shadow-md bg-white p-6 space-y-4 animate-fade-in relative">
          <div className="absolute -top-3.5 left-6 badge bg-card-purple text-on-purple border-2 border-ink font-black uppercase text-[9px] tracking-wider px-2.5 py-0.5">
            SOAL {qIndex + 1} DARI {totalQuestions}
          </div>

          <h2 className="font-display text-xl md:text-2xl font-black text-ink leading-snug pt-1">
            {currentQuestion.question}
          </h2>
        </div>

        <div className="space-y-3">
          {opt.map((text, index) => {
            const isSelected   = selectedAnswer === index;
            const isCorrectHL  = showAnswerFeedback && correctAnswer === index;
            const isWrongHL    = showAnswerFeedback && isSelected && answerState === 'wrong';
            const isFaded      = showAnswerFeedback && !isCorrectHL && !isWrongHL;
            const isDisabled   = selectedAnswer !== null;

            const stateClass =
              isCorrectHL ? 'is-correct !border-3 !border-feedback-correct' :
              isWrongHL   ? 'is-wrong animate-shake !border-3 !border-feedback-wrong' :
              isSelected  ? 'is-selected !border-3 !border-accent-violet' :
              isFaded     ? 'is-faded' : 'border-2 border-rule';

            const letterColor =
              isCorrectHL ? 'bg-feedback-correct text-on-purple border-2 border-ink' :
              isWrongHL   ? 'bg-feedback-wrong text-on-purple border-2 border-ink' :
              isSelected  ? 'bg-card-purple text-on-purple border-2 border-ink' :
              'bg-card-purple text-on-purple border border-rule';

            return (
              <button
                key={index}
                onClick={() => onAnswer(index)}
                disabled={isDisabled}
                className={`option-card ${stateClass} flex items-center gap-3.5 bg-white shadow-sm hover:shadow-md transition-all`}
              >
                <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-display font-extrabold text-sm transition-colors ${letterColor}`}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1 text-sm md:text-base font-bold text-ink text-left leading-snug">
                  {text.replace(/^[A-D]\.\s*/, '')}
                </span>
                {isCorrectHL && <Check className="w-5 h-5 text-feedback-correct-text shrink-0" strokeWidth={3} />}
                {isWrongHL && <span className="text-feedback-wrong-text text-xl font-black shrink-0">✕</span>}
              </button>
            );
          })}
        </div>

        {selectedAnswer !== null && !showAnswerFeedback && (
          <div className="text-center animate-fade-in pt-2">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-ink bg-card-blue text-on-blue text-xs font-black uppercase tracking-wider shadow-sm">
              <span className="w-3.5 h-3.5 border-2 border-on-blue/30 border-t-on-blue rounded-full animate-spin shrink-0" />
              Menunggu Jawaban Lawan…
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
