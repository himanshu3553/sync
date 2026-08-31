'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';

import { setPortalPublicationsBulk } from '@/lib/portal-actions';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface PortalCandidate {
  workflowId: string;
  title: string;
  /** The recording it came from — context when two workflows share a name. */
  recording: string;
}

/**
 * "Add guides" — publish straight from the Knowledge Base: pick any number of ready, unpublished
 * workflows, give them a category, publish in ONE bulk action. The per-workflow publish card stays
 * for the read-it-then-publish flow; this is for filling a portal.
 */
export function PortalAddGuides({
  candidates,
  categorySuggestions,
}: {
  candidates: PortalCandidate[];
  categorySuggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, start] = useTransition();
  const router = useRouter();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => `${c.title} ${c.recording}`.toLowerCase().includes(q));
  }, [candidates, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function publish() {
    const ids = [...selected];
    start(async () => {
      try {
        await setPortalPublicationsBulk({ workflowIds: ids, category });
        toast.success(`${ids.length} ${ids.length === 1 ? 'guide' : 'guides'} published to your portal`);
        setOpen(false);
        setSelected(new Set());
        setQuery('');
        setCategory('');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to publish');
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add guides
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add guides to your portal</DialogTitle>
            <DialogDescription>
              Publish workflows from your Knowledge Base as public help articles — screenshots
              included. Review each one’s content on its Knowledge Base page first.
            </DialogDescription>
          </DialogHeader>

          {candidates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Every ready workflow is already published. Record something new to add more.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-control border px-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search workflows…"
                  className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-control border">
                {visible.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matches.</p>
                ) : (
                  visible.map((c) => (
                    <label
                      key={c.workflowId}
                      className="flex cursor-pointer items-center gap-2.5 border-b px-3 py-2 last:border-b-0 hover:bg-brand-50/50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.workflowId)}
                        onChange={() => toggle(c.workflowId)}
                        className="h-3.5 w-3.5 accent-[color:var(--indigo-500)]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{c.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          from “{c.recording}”
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              <div>
                <Input
                  list="portal-add-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category for the selected guides (empty = General)"
                  maxLength={40}
                  className="h-8 text-xs"
                />
                <datalist id="portal-add-categories">
                  {categorySuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="soft" disabled={busy || selected.size === 0} onClick={publish}>
              Publish {selected.size > 0 ? `${selected.size} ` : ''}selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
