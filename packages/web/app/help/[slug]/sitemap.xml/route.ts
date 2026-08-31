import { getPortal, portalBaseUrl } from '@/lib/portal';

/** Per-portal sitemap: the index + every published article. 404 when the portal is off — the
 *  same gate as the pages, so a disabled portal disappears from crawlers entirely. */

export const revalidate = 900;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;',
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const portal = await getPortal(slug);
  if (!portal) return new Response('Not found', { status: 404 });

  const base = `${portalBaseUrl()}/help/${portal.workspace.slug}`;
  const urls = [
    `<url><loc>${esc(base)}</loc></url>`,
    ...portal.articles.map(
      (a) =>
        `<url><loc>${esc(`${base}/${a.slug}`)}</loc><lastmod>${a.publishedAt.toISOString()}</lastmod></url>`,
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
