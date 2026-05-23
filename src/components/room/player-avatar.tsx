'use client';

/**
 * PlayerAvatar — the rounded coloured tile carrying a player's initial,
 * used in the lobby / result / duel / topic-select screens.
 *
 * Avatar palette is keyed by the player's slot index (0 → host's colour,
 * 1 → opponent's colour), so the same player always gets the same colour
 * across screens. Source palette: `AVATAR_CARDS` / `AVATAR_TEXT` in
 * `use-game-socket.ts`. Three sizes mirror the three usages in the app.
 */

import { AVATAR_CARDS, AVATAR_TEXT } from '@/hooks/use-game-socket';

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<AvatarSize, string> = {
  // Used by the duel-screen sticky score bar (player + opponent).
  sm: 'w-9 h-9 rounded-xl font-extrabold text-sm',
  // Used by the topic-select per-player row.
  md: 'w-10 h-10 rounded-xl font-extrabold text-sm',
  // Used by the lobby VS-board player tiles.
  lg: 'w-16 h-16 rounded-3xl font-extrabold text-lg',
};

interface PlayerAvatarProps {
  name: string;
  /** Slot index in the players array — selects the colour pair. */
  index: number;
  size: AvatarSize;
  /** Tag override: <span> by default; <div> on the topic-select row. */
  as?: 'span' | 'div';
}

export function PlayerAvatar({ name, index, size, as: Tag = 'span' }: PlayerAvatarProps) {
  const card = AVATAR_CARDS[index % AVATAR_CARDS.length];
  const text = AVATAR_TEXT[index % AVATAR_TEXT.length];
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <Tag
      aria-hidden="true"
      className={`shrink-0 flex items-center justify-center font-display border-3 border-ink ${card} ${text} ${SIZE_CLASS[size]}`}
    >
      {initial}
    </Tag>
  );
}
