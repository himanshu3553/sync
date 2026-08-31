'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink } from 'lucide-react';

import { setPortalEnabled } from '@/lib/portal-actions';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The workspace-level Help Portal switch (Settings). Enabling for the FIRST time interposes the
 * screenshot acknowledgment dialog — the recorded consent (`portalAcceptedAt`) that publishing
 * makes recorded screenshots public. Once accepted, the switch toggles plainly both ways: the
 * acknowledgment is history, the switch is the state.
 */
export function PortalSettingsCard({
  enabled,
  accepted,
  portalUrl,
  publishedCount,
  agentIndexUrl = null,
}: {
  enabled: boolean;
  /** Whether `portalAcceptedAt` is already stamped — decides if the dialog interposes. */
  accepted: boolean;
  portalUrl: string;
  publishedCount: number;
  /** The portal's llms.txt URL (the agent door) — shown with a copy action when the portal is live. */
  agentIndexUrl?: string | null;
}) {
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function apply(next: boolean, acknowledged = false) {
    start(async () => {
      try {
        await setPortalEnabled({ enabled: next, acknowledged });
        toast.success(next ? 'Your help portal is live' : 'Your help portal is switched off');
        setConfirming(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update the portal');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Public help portal</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {publishedCount === 0
              ? 'Publish workflows from their Knowledge Base pages to fill it.'
              : `${publishedCount} ${publishedCount === 1 ? 'guide' : 'guides'} published.`}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={busy}
          onCheckedChange={(next) => {
            if (next && !accepted) setConfirming(true);
            else apply(next);
          }}
          aria-label="Enable the public help portal"
        />
      </div>
      {enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={portalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-control border bg-[color:var(--paper-2)] px-2.5 py-1.5 font-mono text-[11px] text-foreground hover:border-primary"
          >
            <span className="truncate">{portalUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </a>
          {agentIndexUrl && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(agentIndexUrl);
                  toast.success('Agent index URL copied — hand it to any AI agent');
                } catch {
                  toast.error('Could not copy to the clipboard');
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-control border bg-[color:var(--paper-2)] px-2.5 py-1.5 font-mono text-[11px] text-foreground hover:border-primary"
              title={agentIndexUrl}
            >
              Copy llms.txt link <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make your help portal public?</DialogTitle>
            <DialogDescription>
              Published guides — including the <strong>screenshots from your recordings</strong> —
              become publicly readable and indexable by search engines. Recorded screenshots can
              show data that was on your screen (names, emails, records). Review each guide&rsquo;s
              screenshots before publishing it, and re-record with demo data if anything on screen
              shouldn&rsquo;t be public.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="soft" disabled={busy} onClick={() => apply(true, true)}>
              I understand — go live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
