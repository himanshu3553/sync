import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { getPortal } from '@/lib/portal';

/**
 * The public help portal's chrome (portal track slice 2) — the ONLY unauthenticated HTML surface
 * the Studio app serves. The workspace gate lives here: portal off (or unknown slug) → 404 for the
 * whole subtree. Pages under it are ISR-cached (`revalidate` below) and revalidated by the publish
 * actions; nothing reads cookies or session, or the caching breaks.
 */

export const revalidate = 900;

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const portal = await getPortal(slug);
  if (!portal) notFound();
  const { workspace } = portal;

  return (
    <div
      className="flex min-h-screen flex-col bg-white text-ink"
      style={{ ['--portal-accent' as string]: workspace.accent }}
    >
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href={`/help/${workspace.slug}`} className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px] font-bold text-white"
              style={{ background: 'var(--portal-accent)' }}
            >
              {workspace.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-[15px] font-semibold tracking-tight">
              {workspace.name} <span className="font-normal text-muted-foreground">Help</span>
            </span>
          </Link>
          {workspace.productUrl && (
            <a
              href={workspace.productUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Open {workspace.name} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-1.5 px-4 py-8 text-center md:px-8">
          <a
            href="https://flowbuddyai.com"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            ⚡ Powered by FlowBuddy
          </a>
          <p className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
            These guides were generated from recordings of {workspace.name} and stay in sync as the
            product changes.
          </p>
        </div>
      </footer>
    </div>
  );
}
