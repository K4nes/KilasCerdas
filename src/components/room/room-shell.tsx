'use client';

/**
 * RoomShell — chrome shared by the 3 in-room screens (lobby, result,
 * topic-select). Hosts the bg-paper main wrapper, the two-blob blur
 * background, the optional toast list, and the optional confetti
 * canvas. The /create page deliberately doesn't use this — its
 * workbench grid layout has different padding + max-width.
 *
 * Header + footer are standalone components rather than props so the
 * caller can interleave their own custom content (the rematch modal,
 * for example, sits between header and main).
 *
 * Why split this out:
 *   - Three screens previously reproduced 30+ LOC of identical chrome.
 *   - Tweaking the blur palette or footer copy meant editing 3 files.
 *   - One concept ("the room shell") had no name in the codebase.
 */

import { ArrowLeft } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import type { Toast } from '@/components/toast';
import { ToastList } from '@/components/toast';

export type RoomShellWidth = 'md' | 'xl';

const MAX_WIDTH_CLASS: Record<RoomShellWidth, string> = {
  md: 'max-w-md',
  xl: 'max-w-xl',
};

// ───────────────────────── RoomShell (outer) ─────────────────────────

interface RoomShellProps {
  toasts?: Toast[];
  /** Pass through if the screen needs a confetti overlay (result only). */
  confettiCanvasRef?: RefObject<HTMLCanvasElement>;
  children: ReactNode;
}

export function RoomShell({ toasts, confettiCanvasRef, children }: RoomShellProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-8 bg-paper relative overflow-hidden">
      {/* Two-blob ambient background — purposefully behind everything. */}
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0" aria-hidden="true">
        <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-purple blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-mint blur-[120px]" />
      </div>

      {toasts && <ToastList toasts={toasts} />}

      {confettiCanvasRef && (
        <canvas
          ref={confettiCanvasRef}
          id="confetti-canvas"
          className="absolute inset-0 pointer-events-none z-0"
        />
      )}

      {children}
    </main>
  );
}

// ───────────────────────── RoomShellHeader ───────────────────────────

interface RoomShellHeaderProps {
  /** Label shown inside the centered nav-pill (e.g. "Lobby Duel"). */
  pillLabel: string;
  /** Container max-width, must match RoomShellFooter for visual alignment. */
  maxWidth?: RoomShellWidth;
  /**
   * When supplied, renders the secondary back button on the left and
   * shifts the nav-pill to the right. Without these, the pill is
   * centered (used by topic-select).
   */
  backLabel?: string;
  onBack?: () => void;
}

export function RoomShellHeader({
  pillLabel,
  maxWidth = 'xl',
  backLabel,
  onBack,
}: RoomShellHeaderProps) {
  const hasBack = backLabel !== undefined && onBack !== undefined;
  const justify = hasBack ? 'justify-between' : 'justify-center';

  return (
    <header className={`w-full ${MAX_WIDTH_CLASS[maxWidth]} mx-auto flex ${justify} items-center z-10 pt-2`}>
      {hasBack && (
        <button
          onClick={onBack}
          className="btn-secondary !rounded-xl !px-4 !py-2 border-3 border-ink bg-white flex items-center gap-2 shadow-sm font-black text-xs uppercase hover:-translate-y-0.5 active:scale-95 transition-transform"
          aria-label={`Kembali ke beranda (${backLabel})`}
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={3} />
          {backLabel}
        </button>
      )}
      <div className="nav-pill border-3 border-ink shadow-sm bg-white py-1.5 px-4">
        <span className="font-display text-[10px] font-black text-ink tracking-widest uppercase">
          {pillLabel}
        </span>
      </div>
    </header>
  );
}

// ───────────────────────── RoomShellFooter ───────────────────────────

interface RoomShellFooterProps {
  /** Container max-width, must match RoomShellHeader for visual alignment. */
  maxWidth?: RoomShellWidth;
}

export function RoomShellFooter({ maxWidth = 'xl' }: RoomShellFooterProps) {
  return (
    <footer
      className={`w-full ${MAX_WIDTH_CLASS[maxWidth]} mx-auto text-center text-ink-body text-xs font-black z-10 border-t-3 border-ink pt-3`}
    >
      <span>© 2026 KILAS CERDAS</span>
    </footer>
  );
}
