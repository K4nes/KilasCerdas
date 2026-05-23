import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Buat Room Duel',
  description:
    'Buat room duel kuis 1v1. Tulis topik bebas, pilih jumlah soal, dan dapatkan kode 6-digit untuk dibagikan ke teman. Soal di-generate oleh Gemini AI.',
  alternates: {
    canonical: '/create',
  },
  openGraph: {
    title: 'Buat Room Duel — Kilas Cerdas',
    description:
      'Buat room duel kuis 1v1 dengan soal AI. Topik bebas, real-time, tanpa login.',
    url: '/create',
    type: 'website',
  },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
