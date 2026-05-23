import type { Metadata, Viewport } from 'next';
import './globals.css';
import MusicToggle from '@/components/music-toggle';
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  OG_LOCALE,
} from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: 'Antigravity' }],
  creator: 'Antigravity',
  publisher: 'Antigravity',
  category: 'games',
  alternates: {
    canonical: '/',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: OG_LOCALE,
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7eedb' },
    { media: '(prefers-color-scheme: dark)', color: '#f7eedb' },
  ],
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  alternateName: 'BrainClash',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: 'id-ID',
  applicationCategory: 'GameApplication',
  applicationSubCategory: 'QuizGame',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript and WebSocket support',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'IDR',
  },
  featureList: [
    'Duel kuis 1v1 real-time',
    'Soal AI-generated dengan Google Gemini',
    'Tanpa login, tanpa iklan',
    'Pilih topik bebas',
    'Multiplayer via kode room',
  ],
  potentialAction: {
    '@type': 'PlayAction',
    target: `${SITE_URL}/create`,
    name: 'Buat Room Duel',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="font-body antialiased text-ink" suppressHydrationWarning>
        <script
          type="application/ld+json"
          // Inline JSON-LD is the standard pattern recommended by Google
          // for adding structured data without an extra network request.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
        <MusicToggle />
      </body>
    </html>
  );
}
