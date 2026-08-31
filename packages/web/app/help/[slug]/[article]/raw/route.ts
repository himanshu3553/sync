import { getPortalAgentMarkdown, portalBaseUrl } from '@/lib/portal';

/**
 * The article's `.md` sibling — the AI-agent manual for one published workflow (the agent door,
 * slice 3). Public URLs arrive as `/help/<slug>/<article>.md` and are rewritten here by the
 * middleware; the direct `/raw` path serves the same content. Stale slugs 301 to the canonical
 * `.md`, mirroring the human page.
 */

export const revalidate = 900;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; article: string }> },
) {
  const { slug, article } = await params;
  const result = await getPortalAgentMarkdown(slug, article);
  if (!result) return new Response('Not found', { status: 404 });

  if (result.canonicalSlug !== article) {
    return Response.redirect(
      `${portalBaseUrl()}/help/${slug}/${result.canonicalSlug}.md`,
      301,
    );
  }

  return new Response(result.markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'x-robots-tag': 'noindex', // agents fetch it; search results should carry the human page
    },
  });
}
