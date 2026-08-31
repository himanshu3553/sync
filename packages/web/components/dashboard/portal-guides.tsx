'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, MoreVertical, Pencil, PlayCircle } from 'lucide-react';

import { renamePortalCategory, setPortalPublication } from '@/lib/portal-actions';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/dashboard/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface PortalGuideRow {
  workflowId: string;
  title: string;
  category: string | null;
  stepCount: number;
  hasVideo: boolean;
  publishedAt: string;
  /** False = the fail-closed state: detached or contentless, silently not served. */
  live: boolean;
  articleUrl: string | null;
  kbHref: string;
  thumbnailUrl: string | null;
}

const GENERAL = 'General';

/**
 * The published-guides table, grouped by category. The Status column is the load-bearing part:
 * "Hidden — needs re-review" is the ONLY place the portal's fail-closed behaviour (a detached or
 * contentless workflow silently stops serving) becomes visible to the founder.
 */
export function PortalGuides({
  rows,
  categorySuggestions,
  portalEnabled,
}: {
  rows: PortalGuideRow[];
  categorySuggestions: string[];
  portalEnabled: boolean;
}) {
  const [busy, start] = useTransition();
  const router = useRouter();
  // One dialog instance, retargeted: either a row's category change or a group rename.
  const [editing, setEditing] = useState<
    | { kind: 'row'; row: PortalGuideRow }
    | { kind: 'group'; from: string | null }
    | null
  >(null);
  const [draft, setDraft] = useState('');

  function run(action: () => Promise<unknown>, done: string, failed: string) {
    start(async () => {
      try {
        await action();
        toast.success(done);
        setEditing(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : failed);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nothing published yet — use “Add guides” to publish workflows from your Knowledge Base.
      </p>
    );
  }

  const categories = [
    ...new Set(rows.map((r) => r.category ?? GENERAL)),
  ].sort((a, b) => (a === GENERAL ? 1 : b === GENERAL ? -1 : a.localeCompare(b)));

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <section key={category}>
          <div className="mb-2 flex items-center gap-1.5">
            <h3 className="text-[13px] font-semibold tracking-tight">{category}</h3>
            {category !== GENERAL && (
              <button
                type="button"
                aria-label={`Rename category ${category}`}
                onClick={() => {
                  setDraft(category);
                  setEditing({ kind: 'group', from: category });
                }}
                className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="divide-y rounded-tile border">
            {rows
              .filter((r) => (r.category ?? GENERAL) === category)
              .map((row) => (
                <div key={row.workflowId} className="flex items-center gap-3 px-3 py-2.5">
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnailUrl}
                      alt=""
                      className="h-9 w-14 shrink-0 rounded border object-cover object-top"
                    />
                  ) : (
                    <span className="h-9 w-14 shrink-0 rounded border bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{row.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {row.stepCount} {row.stepCount === 1 ? 'step' : 'steps'}
                      </span>
                      {row.hasVideo && (
                        <span className="inline-flex items-center gap-1">
                          <PlayCircle className="h-3 w-3" /> Video
                        </span>
                      )}
                      <span>Published {new Date(row.publishedAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  {row.live ? (
                    <StatusBadge tone={portalEnabled ? 'live' : 'pending'}>
                      {portalEnabled ? 'Live' : 'Portal off'}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="pending">Hidden — needs re-review</StatusBadge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Actions for ${row.title}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {row.articleUrl && (
                        <DropdownMenuItem asChild>
                          <a href={row.articleUrl} target="_blank" rel="noreferrer">
                            View article <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={row.kbHref}>Open in Knowledge Base</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setDraft(row.category ?? '');
                          setEditing({ kind: 'row', row });
                        }}
                      >
                        Change category
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger-text focus:text-danger-text"
                        onSelect={() =>
                          run(
                            () => setPortalPublication({ workflowId: row.workflowId, published: false }),
                            `“${row.title}” removed from your portal`,
                            'Failed to unpublish',
                          )
                        }
                      >
                        Unpublish
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
          </div>
        </section>
      ))}

      <Dialog open={editing != null} onOpenChange={(open) => !busy && !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.kind === 'group' ? `Rename “${editing.from}”` : 'Change category'}
            </DialogTitle>
            <DialogDescription>
              {editing?.kind === 'group'
                ? 'Every guide in this category moves with it. Leave empty to move them to General.'
                : 'Pick an existing category or type a new one. Leave empty for General.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            list="portal-guides-categories"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Category (e.g. Getting Started)"
            maxLength={40}
          />
          <datalist id="portal-guides-categories">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="soft"
              disabled={busy}
              onClick={() => {
                if (!editing) return;
                if (editing.kind === 'group') {
                  run(
                    () => renamePortalCategory({ from: editing.from, to: draft }),
                    'Category renamed',
                    'Failed to rename the category',
                  );
                } else {
                  run(
                    () =>
                      setPortalPublication({
                        workflowId: editing.row.workflowId,
                        published: true,
                        category: draft,
                      }),
                    'Category updated',
                    'Failed to update the category',
                  );
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
