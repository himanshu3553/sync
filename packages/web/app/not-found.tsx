import Link from 'next/link';

/**
 * The app-wide 404 — also the boundary that lets LAYOUTS call notFound() (the portal layout's
 * workspace gate throws there; without a root boundary that throw is a 500, not a 404).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="text-xl font-bold tracking-tight text-ink">This page doesn&rsquo;t exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be out of date, or the page it pointed to is no longer published.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
      >
        Go home
      </Link>
    </main>
  );
}
