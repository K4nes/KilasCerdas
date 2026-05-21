'use client';

// ─── Toast: minimal, auto-dismiss feedback pill ──────────────────
// Reusable presentational component. State (push/dismiss) lives in
// the consumer (e.g., src/app/room/[id]/page.tsx). No context, no
// portal, no library — fixed positioning means it overlays naturally
// from wherever it is mounted in the active branch.

export type ToastVariant = 'pink' | 'red' | 'neutral';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

// Variant → color tokens (locked design system, no inline OKLCH).
const variantClasses: Record<ToastVariant, string> = {
  pink:    'bg-card-pink text-on-pink',
  red:     'bg-feedback-wrong-bg text-feedback-wrong-text',
  neutral: 'bg-paper-2 text-ink border border-rule-2',
};

export function ToastList({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.variant === 'red' ? 'alert' : undefined}
          className={`
            ${variantClasses[t.variant]}
            px-5 py-2.5 rounded-full shadow-md
            font-semibold text-sm leading-snug text-center
            max-w-full break-words
            animate-scale-in
          `}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
