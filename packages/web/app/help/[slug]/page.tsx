import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, FileText, PlayCircle } from 'lucide-react';
import { getPortal, portalBaseUrl } from '@/lib/portal';
import { PortalSearch } from '@/components/portal/portal-search';

/**
 * The portal index: gradient hero + instant search + quick links, then the published guides in
 * founder-assigned category sections (server-rendered — the search dropdown overlays rather than
 * replacing them, so crawlers always see the full list).
 */

export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const portal = await getPortal(slug);
  if (!portal) return {};
  const title = `${portal.workspace.name} Help Center`;
  const description = `Step-by-step guides for ${portal.workspace.name} — generated from the product itself and kept in sync.`;
  const url = `${portalBaseUrl()}/help/${portal.workspace.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: title },
    robots: { index: true, follow: true },
  };
}

function anchorFor(category: string): string {
  return `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export default async function PortalIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const portal = await getPortal(slug);
  if (!portal) notFound();
  const { workspace, articles, categories } = portal;
  const base = `/help/${workspace.slug}`;

  const quickLinks = [...articles]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 2);

  return (
    // Explicit m/p/max-w: globals.css gives a bare <main> a 720px legacy shell — override it here.
    <main className="m-0 w-full max-w-none p-0">
      {/* Hero */}
      <section
        className="px-4 pb-16 pt-14 text-center md:px-8 md:pb-20 md:pt-20"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--portal-accent) 88%, #ffffff) 0%, var(--portal-accent) 60%, color-mix(in srgb, var(--portal-accent) 72%, #14161f) 100%)',
        }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          {workspace.name} Help Center
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 md:text-base">
          Find answers and step-by-step guides, straight from the product.
        </p>
        <div className="mt-7">
          <PortalSearch
            items={articles.map((a) => ({
              href: `${base}/${a.slug}`,
              title: a.title,
              description: a.description ?? '',
              category: a.category,
            }))}
          />
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
        {articles.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No guides published yet — check back soon.
          </p>
        ) : (
          <>
            {/* Quick links */}
            {quickLinks.length > 0 && (
              <div className="mb-10 flex flex-wrap justify-center gap-2.5">
                {quickLinks.map((a) => (
                  <Link
                    key={a.workflowId}
                    href={`${base}/${a.slug}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-[13px] font-medium text-ink shadow-sm transition hover:border-[color:var(--portal-accent)]"
                  >
                    <span className="truncate">{a.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}

            {/* Category overview (only worth a grid when there is more than one) */}
            {categories.length > 1 && (
              <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c) => {
                  const count = articles.filter((a) => a.category === c).length;
                  return (
                    <a
                      key={c}
                      href={`#${anchorFor(c)}`}
                      className="rounded-2xl border bg-white p-5 transition hover:border-[color:var(--portal-accent)] hover:shadow-md"
                    >
                      <p className="text-[15px] font-semibold text-ink">{c}</p>
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        {count} {count === 1 ? 'guide' : 'guides'}
                      </p>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Guides by category */}
            {categories.map((c) => (
              <section key={c} id={anchorFor(c)} className="mb-12 scroll-mt-20">
                <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">{c}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {articles
                    .filter((a) => a.category === c)
                    .map((a) => (
                      <Link
                        key={a.workflowId}
                        href={`${base}/${a.slug}`}
                        className="group flex flex-col rounded-2xl border bg-white p-5 transition hover:border-[color:var(--portal-accent)] hover:shadow-md"
                      >
                        <h3 className="text-[15px] font-semibold leading-snug text-ink group-hover:text-[color:var(--portal-accent)]">
                          {a.title}
                        </h3>
                        {a.description && (
                          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                            {a.description}
                          </p>
                        )}
                        <p className="mt-auto flex items-center gap-3 pt-3 text-[11px] font-medium text-muted-foreground">
                          <span>
                            {a.stepCount} {a.stepCount === 1 ? 'step' : 'steps'}
                          </span>
                          {a.hasVideo && (
                            <span className="inline-flex items-center gap-1 text-[color:var(--portal-accent)]">
                              <PlayCircle className="h-3.5 w-3.5" aria-hidden /> Video
                            </span>
                          )}
                        </p>
                      </Link>
                    ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
