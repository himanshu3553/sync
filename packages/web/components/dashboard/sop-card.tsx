'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';

/**
 * The SOP block for one workflow: export the same approved steps as documents — a human
 * step-by-step guide (markdown + annotated screenshots, zipped) and a text-only manual for
 * third-party AI agents. Nothing is stored: both downloads compile on request from the live
 * workflow, so there is no Regenerate and no staleness state here (unlike the video above).
 */
export function SopCard({
  sourceId,
  wf,
  agentMarkdown,
}: {
  sourceId: string;
  wf: number;
  /** The agent rendering, compiled server-side — previewed so the founder can read exactly
   *  what an outside agent would be handed before sharing it anywhere. */
  agentMarkdown: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const base = `/dashboard/kb/${sourceId}/sop?wf=${wf}`;

  async function copyAgent() {
    try {
      await navigator.clipboard.writeText(agentMarkdown);
      toast.success('AI agent manual copied — paste it into any agent');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">Step-by-step guide</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Markdown with an annotated screenshot per step — ready for your help center or
            training docs.
          </p>
        </div>
        <Button size="sm" variant="soft" asChild>
          <a href={`${base}&kind=guide`} download>
            Download .zip
          </a>
        </Button>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">AI agent manual</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              A text-only manual AI agents (Claude, Codex, …) read to learn and operate this
              workflow — routes and expected outcomes, no screenshots, and input values are always
              asked from the user, never included.
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={copyAgent}>
              Copy
            </Button>
            <Button size="sm" variant="soft" asChild>
              <a href={`${base}&kind=agent`} download>
                Download .md
              </a>
            </Button>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${previewOpen ? 'rotate-90' : ''}`} />
          {previewOpen ? 'Hide preview' : 'Preview what agents receive'}
        </button>
        {previewOpen && (
          <pre className="mt-2 max-h-72 overflow-auto rounded-control border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {agentMarkdown}
          </pre>
        )}
      </div>
    </div>
  );
}
