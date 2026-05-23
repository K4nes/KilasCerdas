import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * /api/* — server-only, never useful in search.
 * /room/* — ephemeral game sessions; surfacing them would dilute index
 *           and create stale results when rooms close.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/create'],
        disallow: ['/api/', '/room/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
