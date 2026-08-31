import { NextResponse, type NextRequest } from 'next/server';

/**
 * One rewrite, nothing else: a portal article's `.md` sibling URL — the agent door's canonical
 * shape, `/help/<slug>/<article>.md` — is served by the route handler at `[article]/raw` (a page
 * and a route handler cannot share the `[article]` segment, and a dynamic segment can't carry a
 * literal suffix). The rewrite is internal; the public URL stays `.md`.
 *
 * The matcher keeps this middleware OFF every other request in the app — the dashboard, auth and
 * widget paths never pass through here.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.endsWith('.md')) {
    const url = req.nextUrl.clone();
    url.pathname = `${pathname.slice(0, -3)}/raw`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  // Two path segments under /help — the article level, where the .md siblings live.
  matcher: ['/help/:slug/:article'],
};
