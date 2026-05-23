import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/seo';

export const runtime = 'edge';
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Dynamic Open Graph image for social shares (Twitter, WhatsApp, FB, LinkedIn).
 * Matches Matcha Berry brand: cream paper, deep ink stroke, bubblegum pink accent.
 * Uses inline SVG instead of external fonts for zero-network rendering.
 */
export default async function OpenGraphImage() {
  const ink = '#1c3327';
  const paper = '#f7eedb';
  const pink = '#f49bc4';
  const mint = '#cce8c4';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: paper,
          padding: '56px 72px',
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Decorative blob top-right (atmospheric depth) */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -160,
            width: 440,
            height: 440,
            borderRadius: '50%',
            background: pink,
            opacity: 0.55,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            left: -140,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: mint,
            opacity: 0.5,
            display: 'flex',
          }}
        />

        {/* Brand pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '10px 22px',
            background: paper,
            border: `4px solid ${ink}`,
            borderRadius: 999,
            alignSelf: 'flex-start',
            boxShadow: `5px 5px 0 ${ink}`,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: pink,
              border: `3px solid ${ink}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            ✦
          </div>
          <span
            style={{
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: '0.04em',
              color: ink,
            }}
          >
            KILAS CERDAS
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 38,
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 92,
              fontWeight: 900,
              color: ink,
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            Duel Seru,
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 900,
              color: ink,
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              display: 'flex',
              marginTop: 6,
            }}
          >
            Adu{' '}
            <span
              style={{
                color: pink,
                textDecoration: 'underline',
                textDecorationColor: ink,
                textDecorationThickness: 7,
                textUnderlineOffset: 10,
                marginLeft: 20,
              }}
            >
              Cerdas
            </span>
          </div>
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: ink,
            opacity: 0.85,
            marginTop: 26,
            maxWidth: 880,
            lineHeight: 1.3,
            zIndex: 1,
            display: 'flex',
          }}
        >
          Kuis duel 1v1 real-time dengan soal AI-generated. Pilih topik, bagikan kode, mainkan.
        </div>

        {/* Footer chips */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            marginTop: 'auto',
            zIndex: 1,
          }}
        >
          {['Real-time', 'AI-Powered', 'Tanpa Login'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                padding: '10px 20px',
                background: paper,
                border: `3px solid ${ink}`,
                borderRadius: 999,
                fontSize: 22,
                fontWeight: 900,
                color: ink,
                letterSpacing: '0.05em',
                boxShadow: `4px 4px 0 ${ink}`,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
