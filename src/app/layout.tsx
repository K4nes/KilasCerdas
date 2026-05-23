import type { Metadata, Viewport } from 'next';
import './globals.css';
import MusicToggle from '@/components/music-toggle';

export const metadata: Metadata = {
  title: 'Kilas Cerdas — Duel Pengetahuan Real-Time',
  description: 'Duel flashcard real-time dengan soal AI-generated. Belajar sambil bersaing.',
  openGraph: {
    title: 'Kilas Cerdas',
    description: 'Duel flashcard real-time dengan soal AI-generated.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#f7eedb',
  width: 'device-width',
  initialScale: 1,
 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="font-body antialiased text-ink" suppressHydrationWarning>
        {children}
        <MusicToggle />
      </body>
    </html>
  );
}
