'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Search } from 'lucide-react';

export interface PortalSearchItem {
  href: string;
  title: string;
  description: string;
  category: string;
}

/**
 * The portal hero's instant search — pure client-side filtering over the (small) published-article
 * list, rendered as a dropdown so the server-rendered category sections below stay untouched and
 * indexable. Real retrieval-backed search (with no-result gap logging) is the portal track's
 * search module; this deliberately ships without a backend or a cost surface.
 */
export function PortalSearch({ items }: { items: PortalSearchItem[] }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return items
      .map((item) => {
        const hay = `${item.title} ${item.description} ${item.category}`.toLowerCase();
        const hits = terms.filter((t) => hay.includes(t)).length;
        const titleHit = item.title.toLowerCase().includes(q) ? 1 : 0;
        return { item, score: hits === terms.length ? hits + titleHit : 0 };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((r) => r.item);
  }, [items, query]);

  const open = focused && query.trim().length > 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="flex items-center gap-2.5 rounded-full bg-white py-3 pl-5 pr-5 shadow-lg ring-1 ring-black/5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            // Delay so a click on a result completes before the dropdown unmounts.
            blurTimer.current = setTimeout(() => setFocused(false), 150);
          }}
          placeholder="Search guides…"
          aria-label="Search guides"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-white text-left shadow-xl ring-1 ring-black/5">
          {results.length === 0 ? (
            <p className="px-4 py-3.5 text-sm text-muted-foreground">
              No guides match “{query.trim()}”.
            </p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.href} className="border-b last:border-b-0">
                  <Link href={r.href} className="flex items-start gap-3 px-4 py-3 transition hover:bg-brand-50">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--portal-accent)]" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.category}
                        {r.description ? ` · ${r.description}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
