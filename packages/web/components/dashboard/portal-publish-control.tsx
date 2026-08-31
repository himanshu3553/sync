'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { setPortalPublication } from '@/lib/portal-actions';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/dashboard/status-badge';

/**
 * The Help Portal publish control for ONE workflow — the portal sibling of the approval switch.
 * Publishing is independent of copilot approval (per-audience approval over the same KB), and the
 * warning is load-bearing: publishing makes the workflow's SCREENSHOTS public, which is exactly
 * what the founder acknowledged at the workspace switch — this card keeps saying it per workflow.
 */
export function PortalPublishControl({
  workflowId,
  segmentTitle,
  published,
  category,
  categorySuggestions,
  articleUrl,
  portalEnabled,
  ready,
}: {
  workflowId: string;
  segmentTitle: string;
  published: boolean;
  category: string | null;
  /** Existing categories in this workspace, offered as datalist suggestions. */
  categorySuggestions: string[];
  /** Public URL of this article (present when published and the portal is enabled). */
  articleUrl: string | null;
  portalEnabled: boolean;
  ready: boolean;
}) {
  const [busy, start] = useTransition();
  const [draftCategory, setDraftCategory] = useState(category ?? '');
  const router = useRouter();

  function run(action: () => Promise<unknown>, done: string, failed: string) {
    start(async () => {
      try {
        await action();
        toast.success(done);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : failed);
      }
    });
  }

  if (!ready) {
    return (
      <div className="rounded-control border border-dashed bg-[color:var(--paper-2)] px-2.5 py-2 text-[11px] text-muted-foreground">
        Still building — there is nothing to publish yet.
      </div>
    );
  }

  const listId = `portal-categories-${workflowId}`;
  const categoryInput = (
    <>
      <Input
        list={listId}
        value={draftCategory}
        onChange={(e) => setDraftCategory(e.target.value)}
        placeholder="Category (e.g. Getting Started)"
        maxLength={40}
        className="h-8 text-xs"
      />
      <datalist id={listId}>
        {categorySuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );

  if (!published) {
    return (
      <div className="space-y-2.5">
        {categoryInput}
        <Button
          size="sm"
          variant="soft"
          disabled={busy}
          className="w-full"
          onClick={() =>
            run(
              () => setPortalPublication({ workflowId, published: true, category: draftCategory }),
              `“${segmentTitle}” published to your help portal`,
              'Failed to publish',
            )
          }
        >
          Publish to portal
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Publishing makes this guide — including its screenshots — publicly readable
          {portalEnabled ? '' : ' once the portal is switched on in Settings'}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge tone={portalEnabled ? 'live' : 'pending'}>
          {portalEnabled ? 'Published' : 'Published — portal off'}
        </StatusBadge>
        {articleUrl && (
          <a
            href={articleUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            View article <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">{categoryInput}</div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || (draftCategory.trim() || null) === (category ?? null)}
          onClick={() =>
            run(
              () => setPortalPublication({ workflowId, published: true, category: draftCategory }),
              'Category updated',
              'Failed to update the category',
            )
          }
        >
          Save
        </Button>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        className="w-full"
        onClick={() =>
          run(
            () => setPortalPublication({ workflowId, published: false }),
            `“${segmentTitle}” removed from your help portal`,
            'Failed to unpublish',
          )
        }
      >
        Unpublish
      </Button>
    </div>
  );
}
