import type { Metadata } from 'next';

/**
 * Game rooms are ephemeral and per-session. Force noindex/nofollow so
 * search engines never surface a stale room URL or expose game state.
 */
export const metadata: Metadata = {
  title: 'Room Duel',
  description: 'Sesi duel kuis aktif di Kilas Cerdas.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
