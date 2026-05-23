import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * Apple touch icon (180x180 PNG) — used when users add the site to
 * their iOS home screen. SVG icons aren't supported there.
 */
export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#f49bc4',
          border: '14px solid #1c3327',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 130,
          color: '#f7eedb',
          fontWeight: 900,
          // Use a bold star glyph rather than an embedded font so this
          // renders identically across edge runtimes without font loading.
          fontFamily: 'system-ui, -apple-system, "Apple Color Emoji", sans-serif',
        }}
      >
        ✦
      </div>
    ),
    { ...size },
  );
}
