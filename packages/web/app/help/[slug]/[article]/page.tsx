import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getPortalArticle, portalBaseUrl } from '@/lib/portal';
import { boxStyle } from '@/lib/bbox-style';
import { ArticleToc } from '@/components/portal/article-toc';

/**
 * A portal article — one published workflow, rendered: description as the intro (the plan: choices
 * and optional parts), demo video when one is rendered, then the steps with screenshot + highlight
 * (the same CSS-overlay approach as the Studio, computed server-side — no image processing at
 * serve time). Three columns on desktop: sibling-guide nav · content · step TOC.
 *
 * SEO: the slug's title half is display; the trailing id suffix resolves. A stale slug (edited
 * title) 301s to the canonical so old links keep working without splitting page rank. HowTo +
 * BreadcrumbList (+ VideoObject) JSON-LD mirror the visible content exactly.
 */

export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; article: string }>;
}): Promise<Metadata> {
  const { slug, article: articleSlugParam } = await params;
  const data = await getPortalArticle(slug, articleSlugParam);
  if (!data) return {};
  const { portal, article } = data;
  const title = `${article.ref.title} — ${portal.workspace.name} Help`;
  const description =
    article.ref.description ??
    `Step-by-step guide: ${article.ref.title} in ${portal.workspace.name}.`;
  const url = `${portalBaseUrl()}/help/${portal.workspace.slug}/${article.ref.slug}`;
  return {
    title,
    description,
    // The .md alternate is the agent door (slice 3): the same guide as agent-readable markdown.
    alternates: { canonical: url, types: { 'text/markdown': `${url}.md` } },
    openGraph: { title, description, url, type: 'article', siteName: `${portal.workspace.name} Help Center` },
    robots: { index: true, follow: true },
  };
}

export default async function PortalArticlePage({
  params,
}: {
  params: Promise<{ slug: string; article: string }>;
}) {
  const { slug, article: articleSlugParam } = await params;
  const data = await getPortalArticle(slug, articleSlugParam);
  if (!data) notFound();
  const { portal, article } = data;
  const { workspace, articles, categories } = portal;
  const base = `/help/${workspace.slug}`;

  // Old links (edited title) 301 to the canonical slug — one URL per article.
  if (articleSlugParam !== article.ref.slug) permanentRedirect(`${base}/${article.ref.slug}`);

  const pageUrl = `${portalBaseUrl()}${base}/${article.ref.slug}`;
  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: article.ref.title,
      ...(article.ref.description ? { description: article.ref.description } : {}),
      step: article.steps.map((s) => ({
        '@type': 'HowToStep',
        position: s.number,
        name: s.instruction,
        ...(s.detail ? { text: s.detail } : {}),
        url: `${pageUrl}#step-${s.number}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: `${workspace.name} Help`, item: `${portalBaseUrl()}${base}` },
        { '@type': 'ListItem', position: 2, name: article.ref.title, item: pageUrl },
      ],
    },
    ...(article.videoUrl
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            name: `${article.ref.title} — video guide`,
            description: article.ref.description ?? article.ref.title,
            contentUrl: article.videoUrl,
            uploadDate: article.ref.publishedAt.toISOString(),
          },
        ]
      : []),
  ];

  return (
    // my-0 included: globals.css gives a bare <main> a 40px block margin — the page owns its rhythm.
    <main className="mx-auto my-0 w-full max-w-6xl px-4 py-8 md:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px]">
        {/* Sibling-guide nav */}
        <aside className="hidden lg:block">
          <nav aria-label="All guides" className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 text-[13px]">
            {categories.map((c) => (
              <div key={c} className="mb-5">
                <p className="mb-1.5 font-semibold text-ink">{c}</p>
                <ul className="space-y-0.5">
                  {articles
                    .filter((a) => a.category === c)
                    .map((a) => {
                      const current = a.workflowId === article.ref.workflowId;
                      return (
                        <li key={a.workflowId}>
                          <Link
                            href={`${base}/${a.slug}`}
                            aria-current={current ? 'page' : undefined}
                            className={`block truncate rounded-md px-2 py-1 transition ${
                              current
                                ? 'bg-brand-50 font-medium text-[color:var(--portal-accent)]'
                                : 'text-muted-foreground hover:bg-[color:var(--paper-2)] hover:text-ink'
                            }`}
                          >
                            {a.title}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Article */}
        <article className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
            <Link href={base} className="hover:text-ink">
              {workspace.name} Help
            </Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span>{article.ref.category}</span>
          </nav>

          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{article.ref.title}</h1>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {article.steps.length} {article.steps.length === 1 ? 'step' : 'steps'}
            <span aria-hidden> · </span>
            <a
              href={`${base}/${article.ref.slug}.md`}
              className="underline decoration-dotted underline-offset-2 hover:text-ink"
            >
              Markdown for AI agents
            </a>
          </p>

          {article.videoUrl && (
            /* eslint-disable-next-line jsx-a11y/media-has-caption -- the narration IS the content */
            <video
              src={article.videoUrl}
              controls
              preload="metadata"
              className="mt-6 w-full rounded-xl border bg-black"
            />
          )}

          {article.ref.description && (
            <div
              className="mt-6 rounded-xl border border-brand-100 bg-brand-50 px-5 py-4 text-[15px] leading-relaxed text-ink"
              style={{ borderLeftWidth: 3, borderLeftColor: 'var(--portal-accent)' }}
            >
              {article.ref.description}
            </div>
          )}

          <div className="mt-2">
            {article.steps.map((step) => {
              const highlight =
                step.bbox && article.viewport ? boxStyle(step.bbox, article.viewport) : null;
              return (
                <section key={step.number} id={`step-${step.number}`} className="mt-10 scroll-mt-20">
                  <h2 className="flex items-start gap-3 text-lg font-semibold leading-snug tracking-tight text-ink">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
                      style={{ background: 'var(--portal-accent)' }}
                    >
                      {step.number}
                    </span>
                    {step.instruction}
                  </h2>
                  {step.detail && (
                    <p className="mt-2 pl-9 text-[15px] leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  )}
                  {step.screenshotUrl && (
                    <figure
                      className="mt-4 rounded-2xl border border-brand-100 p-2 md:p-3"
                      style={{
                        background:
                          'linear-gradient(135deg, color-mix(in srgb, var(--portal-accent) 10%, #ffffff), color-mix(in srgb, var(--portal-accent) 4%, #ffffff))',
                      }}
                    >
                      <span className="relative block overflow-hidden rounded-lg border bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={step.screenshotUrl}
                          alt={`Step ${step.number}: ${step.instruction}`}
                          loading={step.number > 1 ? 'lazy' : 'eager'}
                          className="block w-full"
                        />
                        {highlight && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute rounded-[4px]"
                            style={{
                              ...highlight,
                              border: '2px solid var(--portal-accent)',
                              boxShadow:
                                '0 0 0 2px color-mix(in srgb, var(--portal-accent) 25%, transparent), 0 2px 12px color-mix(in srgb, var(--portal-accent) 45%, transparent)',
                            }}
                          />
                        )}
                      </span>
                    </figure>
                  )}
                </section>
              );
            })}
          </div>
        </article>

        {/* Step TOC */}
        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <ArticleToc
              items={article.steps.map((s) => ({ id: `step-${s.number}`, label: `${s.number}. ${s.instruction}` }))}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
