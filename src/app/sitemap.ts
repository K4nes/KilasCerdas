import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * Static sitemap for indexable routes only.
 * /room/[id] is dynamic, ephemeral, and per-game — excluded from index
 * via the route-level `robots.noindex` and matching robots.ts disallow.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/create`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
