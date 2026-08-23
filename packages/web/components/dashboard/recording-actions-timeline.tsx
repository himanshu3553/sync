'use client';

import { useState } from 'react';
import {
  ChevronDown,
  Circle,
  CornerDownLeft,
  Flag,
  Hand,
  Keyboard,
  Maximize2,
  MousePointerClick,
  Navigation,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/recordings';
import { ImageLightbox, type LightboxImage } from '@/components/dashboard/image-lightbox';

const EVENT_ICON: Record<string, typeof MousePointerClick> = {
  click: MousePointerClick,
  input: Keyboard,
  submit: CornerDownLeft,
  nav: Navigation,
  scroll: Hand,
  keydown: Keyboard,
  marker: Flag,
};

/** How many captured actions the timeline shows before "Show more" — enough to read the shape of
 *  a recording without a 200-row wall on every detail page. */
const INITIAL_ROWS = 10;

export interface TimelineRow {
  id: string;
  t: number;
  type: string;
  label: string;
  routePath: string | null;
  /** Presigned screenshot URL, if this action captured one. */
  url: string | null;
}

export function RecordingActionsTimeline({ rows }: { rows: TimelineRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const visible = expanded ? rows : rows.slice(0, INITIAL_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <>
      <ul className="overflow-hidden rounded-card border bg-card">
        {visible.map((e, i) => {
          const Icon = EVENT_ICON[e.type] || Circle;
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
            >
              <span className="w-10 shrink-0 font-mono text-[10.5px] tabular-nums text-faint">
                {formatDuration(e.t)}
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  <span className="font-mono text-[10.5px] uppercase text-muted-foreground">
                    {e.type}
                  </span>{' '}
                  {e.label}
                </span>
                {e.routePath && (
                  <span className="block truncate font-mono text-[10px] text-faint">
                    {e.routePath}
                  </span>
                )}
              </span>
              {e.url && (
                <button
                  type="button"
                  aria-label={`Open the screenshot of action ${i + 1} larger`}
                  onClick={() => setLightbox({ url: e.url!, title: `${e.type} ${e.label}`.trim() })}
                  className="group/shot relative hidden h-9 w-14 shrink-0 overflow-hidden rounded border border-[color:var(--media-border)] bg-media transition hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.url} alt="" className="h-full w-full object-cover object-top" />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/10 opacity-0 transition group-hover/shot:opacity-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-card">
                      <Maximize2 className="h-3 w-3" />
                    </span>
                  </span>
                </button>
              )}
              <span className="w-2 shrink-0 text-right font-mono text-[10px] text-faint">
                {i + 1}
              </span>
            </li>
          );
        })}
        {rows.length > INITIAL_ROWS && (
          <li className="border-t">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-brand-50"
            >
              {expanded ? 'Show less' : `Show more (${hidden})`}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          </li>
        )}
      </ul>
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
