'use client';

import { useEffect, useState } from 'react';

/**
 * "On this page" — the article's step list with scroll-spy highlighting. Links are plain anchors
 * (server-renderable, crawlable); this component only adds the active state as the reader scrolls.
 */
export function ArticleToc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost intersecting section wins; keep the last active when none intersect
        // (between sections while scrolling fast).
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="text-[13px]">
      <p className="mb-2.5 font-semibold text-ink">On this page</p>
      <ul className="space-y-0.5 border-l">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`-ml-px block truncate border-l-2 py-1 pl-3 transition ${
                active === item.id
                  ? 'border-[color:var(--portal-accent)] font-medium text-ink'
                  : 'border-transparent text-muted-foreground hover:text-ink'
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
