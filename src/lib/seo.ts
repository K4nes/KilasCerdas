/**
 * Single source of truth for the public origin used in metadata,
 * sitemap, OG tags, and JSON-LD. Set NEXT_PUBLIC_SITE_URL in env;
 * defaults to localhost for dev so links still resolve sensibly.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'Kilas Cerdas';

export const SITE_TAGLINE = 'Duel Pengetahuan Real-Time';

export const SITE_DESCRIPTION =
  'Kilas Cerdas adalah game kuis duel 1v1 real-time dengan soal AI-generated dari Gemini. ' +
  'Pilih topik bebas, bagikan kode room ke teman, dan adu wawasan dalam hitungan detik.';

export const SITE_KEYWORDS = [
  'kuis online',
  'kuis duel',
  'kuis multiplayer',
  'duel kuis online',
  'game kuis 1v1',
  'kuis real-time',
  'kuis AI',
  'soal AI generated',
  'belajar sambil bermain',
  'flashcard duel',
  'trivia indonesia',
  'kuis indonesia',
  'kilas cerdas',
];

export const OG_LOCALE = 'id_ID';
