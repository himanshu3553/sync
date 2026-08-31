import type { MetadataRoute } from 'next';

/**
 * The Studio app's robots policy: only the public help portals are crawlable. Everything else on
 * this host is the authenticated dashboard (or auth pages) — indexing those would surface
 * sign-in screens in search results. Per-portal sitemaps live under each portal's own path.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/help/', disallow: '/' },
    ],
  };
}
