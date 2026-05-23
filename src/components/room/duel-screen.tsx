'use client';

import { Clock, Check } from 'lucide-react';
import type { Player, Question } from '@/lib/types';
import { PlayerAvatar } from '@/components/room/player-avatar';

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
      <div className="sticky top-0 z-20 bg-surface border-b-3 border-ink">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <PlayerAvatar name={playerName} index={0} size="sm" />
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
                  className={`w-2 h-2 rounded-full border-2 border-ink transition-all ${
                    i < qIndex ? 'bg-accent-violet'
                    : i === qIndex ? 'bg-accent-pink w-4'
                    : 'bg-white'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 min-w-0 flex-row-reverse">
            <PlayerAvatar name={opponent?.name || '?'} index={1} size="sm" />
            <div className="min-w-0 text-right">
              <p className="text-[10px] uppercase tracking-wider text-ink font-black truncate">
                {opponent?.name || 'Lawan'}
              </p>
              <p className="font-display text-lg font-black text-ink leading-none tabular-nums">{opponentScore}</p>
            </div>
          </div>
        </div>

        <div className="h-2 bg-paper border-t-3 border-ink">
          <div
            className={`h-full timer-bar ${timerBgClass}`}
            style={{ width: `${timerWidth}%` }}
          />
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="card border-3 border-ink bg-white p-6 space-y-4 animate-fade-in relative">
          <div className="absolute -top-3.5 left-6 badge bg-card-purple text-on-purple border-3 border-ink font-black uppercase text-[9px] tracking-wider px-3 py-1">
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
              isCorrectHL ? 'is-correct' :
              isWrongHL   ? 'is-wrong animate-shake' :
              isSelected  ? 'is-selected' :
              isFaded     ? 'is-faded' : '';

            const letterBg =
              isCorrectHL ? 'bg-emerald text-white border-3 border-ink' :
              isWrongHL   ? 'bg-peach text-white border-3 border-ink' :
              isSelected  ? 'bg-card-purple text-on-purple border-3 border-ink' :
              'bg-card-purple text-on-purple border-3 border-ink';

            const textClass =
              isCorrectHL || isWrongHL ? 'text-white' : 'text-ink';

            return (
              <button
                key={index}
                onClick={() => onAnswer(index)}
                disabled={isDisabled}
                className={`option-card ${stateClass} flex items-center gap-3.5 bg-white`}
              >
                <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-sm transition-colors ${letterBg}`}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span className={`flex-1 text-sm md:text-base font-black ${textClass} text-left leading-snug`}>
                  {text.replace(/^[A-D]\.\s*/, '')}
                </span>
                {isCorrectHL && <Check className="w-5 h-5 text-white shrink-0" strokeWidth={3} />}
                {isWrongHL && <span className="text-white text-xl font-black shrink-0">✕</span>}
              </button>
            );
          })}
        </div>

        {selectedAnswer !== null && !showAnswerFeedback && (
          <div className="text-center animate-fade-in pt-2">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-3 border-ink bg-card-mint text-on-mint text-xs font-black uppercase tracking-wider shadow-sm">
              <span className="w-3.5 h-3.5 border-3 border-on-mint/30 border-t-on-mint rounded-full animate-spin shrink-0" />
              Menunggu Jawaban Lawan…
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
