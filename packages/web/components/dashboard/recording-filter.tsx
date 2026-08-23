'use client';

import { Check, ListFilter, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The KB's "narrow to these recordings" filter, shared by the workflow list and the product
 * knowledge list (extracted at the second consumer). Nothing ticked = no filtering; the parent
 * owns the selection and applies it to its own rows, since what "from this recording" means
 * differs per list (a workflow has one source, a product page has provenance from several).
 */
export interface FilterRecording {
  id: string;
  title: string;
}

export function RecordingFilter({
  recordings,
  selected,
  onChange,
}: {
  recordings: FilterRecording[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const filtering = selected.size > 0;
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 shrink-0 gap-1.5 px-2.5', filtering && 'border-brand-200 text-primary')}
          aria-label="Filter by recording"
        >
          <ListFilter className="h-4 w-4" />
          Filter
          {filtering && (
            <span className="rounded-pill bg-primary px-1.5 font-mono text-[9.5px] font-bold text-white">
              {selected.size}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Select recordings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {recordings.map((r) => {
            const on = selected.has(r.id);
            return (
              <DropdownMenuItem
                key={r.id}
                role="menuitemcheckbox"
                aria-checked={on}
                // Keep the menu open while ticking several recordings.
                onSelect={(e) => {
                  e.preventDefault();
                  toggle(r.id);
                }}
                className="gap-2.5"
              >
                {/* A real box in BOTH states — the primitive's indicator vanishes when unticked,
                    which made the menu read as a plain list. */}
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                    on ? 'border-primary bg-primary text-white' : 'border-border bg-card',
                  )}
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="truncate">{r.title}</span>
              </DropdownMenuItem>
            );
          })}
        </div>
        {filtering && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(new Set())}>Clear filter</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** What the filter is narrowed to, as removable chips — × unticks that recording. Renders nothing
 *  when nothing is ticked, since "everything" is not a filter worth announcing. */
export function RecordingFilterChips({
  recordings,
  selected,
  onChange,
}: {
  recordings: FilterRecording[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  if (selected.size === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {recordings
        .filter((r) => selected.has(r.id))
        .map((r) => (
          <span
            key={r.id}
            className="inline-flex max-w-xs items-center gap-1.5 rounded-md border border-brand-100 bg-brand-50 py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-primary"
          >
            <span className="truncate">{r.title}</span>
            <button
              type="button"
              onClick={() => {
                const next = new Set(selected);
                next.delete(r.id);
                onChange(next);
              }}
              aria-label={`Remove ${r.title} from the filter`}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-primary/70 transition-colors hover:bg-brand-100 hover:text-primary"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </span>
        ))}
      <button
        type="button"
        onClick={() => onChange(new Set())}
        className="text-[12px] font-medium text-muted-foreground hover:text-foreground hover:underline"
      >
        Clear
      </button>
    </div>
  );
}
