import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { prisma } from '@flowbuddy/db';
import type { SessionManifest } from '@flowbuddy/shared';
import { getCurrentWorkspace } from '@/lib/session';
import { signedUrl, sessionObjectKey } from '@/lib/storage';
import { listCandidates } from '@/lib/candidates';
import { listWorkflowOverlaps } from '@/lib/overlaps';
import { toWorkflowRows } from '@/lib/workflow-rows';
import { KbWorkflowList } from '@/components/dashboard/kb-workflow-list';
import { ArrowUpRight } from 'lucide-react';
import {
  asManifest,
  deriveRecordingMeta,
  timelineEvents,
  formatDuration,
  isRecordingStalled,
  recordingName,
} from '@/lib/recordings';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RecordingManageMenu } from '@/components/dashboard/recording-manage';
import { ReprocessButton } from '@/components/dashboard/recording-reprocess-button';
import { ClampedText } from '@/components/dashboard/clamped-text';
import {
  RecordingActionsTimeline,
  type TimelineRow,
} from '@/components/dashboard/recording-actions-timeline';
import {
  RecordingPlayer,
  type PlayerFrame,
} from '@/components/dashboard/recording-player';

export const dynamic = 'force-dynamic';

export default async function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentWorkspace();
  if (!ctx) redirect('/signin');

  const source = await prisma.knowledgeSource.findFirst({
    where: { id, workspaceId: ctx.workspace.id },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!source) notFound();

  const manifest = asManifest(source.manifest) as SessionManifest | null;
  const meta = deriveRecordingMeta(manifest);
  const events = timelineEvents(manifest);
  const ws = ctx.workspace.id;

  // Sign every captured screenshot once; reuse for the player frames + the timeline thumbnails.
  const shotRels = [...new Set(events.map((e) => e.shotRel).filter((r): r is string => !!r))];
  const shotUrls = new Map<string, string>(
    await Promise.all(
      shotRels.map(
        async (rel) => [rel, await signedUrl(sessionObjectKey(ws, id, rel))] as const,
      ),
    ),
  );
  const audioUrl = meta.audioRel
    ? await signedUrl(sessionObjectKey(ws, id, meta.audioRel))
    : null;

  const frames: PlayerFrame[] = events
    .filter((e) => e.shotRel)
    .map((e) => ({
      t: e.t,
      url: shotUrls.get(e.shotRel!)!,
      type: e.type,
      label: e.label,
      routePath: e.routePath,
    }))
    .sort((a, b) => a.t - b.t);

  const transcript =
    (source.transcript as { text?: string; segments?: unknown[] } | null) ?? null;
  const title = recordingName(source);
  const recordedBy = source.createdBy?.name || source.createdBy?.email || '—';
  const failed = source.status === 'error';
  const stalled = isRecordingStalled(source.status, source.updatedAt);
  const hasReplay = frames.length > 0 || !!audioUrl;
  const timelineRows: TimelineRow[] = events.map((e) => ({
    id: e.id,
    t: e.t,
    type: e.type,
    label: e.label,
    routePath: e.routePath,
    url: e.shotRel ? shotUrls.get(e.shotRel) ?? null : null,
  }));

  const [candidates, overlaps] = await Promise.all([listCandidates(ws, id), listWorkflowOverlaps(ws)]);
  const workflowRows = toWorkflowRows(candidates, overlaps);
  const workflowCount = `${candidates.length} workflow${candidates.length === 1 ? '' : 's'}`;
  const recordedOn = source.createdAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const subtitle = [workflowCount, recordedOn, source.appBaseUrl].filter(Boolean).join(' · ');

  const summary: [string, string][] = [
    ['App', source.appBaseUrl || '—'],
    ['Duration', meta.durationMs ? formatDuration(meta.durationMs) : '—'],
    ['Workflows', String(candidates.length)],
    ['Recorded on', recordedOn],
    ['Recorded by', recordedBy],
  ];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        contentClassName="max-w-6xl px-4 md:px-8"
        actions={
          <div className="flex items-center gap-2">
            <RecordingManageMenu
              vertical
              id={source.id}
              currentTitle={source.title}
              appUrl={source.generatedTitle || source.appBaseUrl}
              status={source.status}
              redirectOnDelete
            />
          </div>
        }
      />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8">
        {failed && (
          <div className="rounded-card border border-danger-border bg-danger-bg px-4 py-3.5">
            <p className="text-sm font-semibold text-danger-text">
              This recording failed to process.
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-danger-ink">
              {source.error || 'Capture or synthesis was interrupted.'}
            </p>
            <div className="mt-2.5">
              <ReprocessButton id={source.id} />
            </div>
          </div>
        )}

        {/* Degraded-but-successful build (§3.3): the worker lands `ready` but leaves a warning in
            `error` (e.g. narration failed to transcribe) — a notice, not a failure. */}
        {!failed && source.status === 'ready' && source.error && (
          <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-3.5">
            <p className="text-sm font-semibold text-warning-text">
              Processed with a warning.
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-warning-text">
              {source.error}
            </p>
          </div>
        )}

        {stalled && (
          <div className="rounded-card border border-danger-border bg-danger-bg px-4 py-3.5">
            <p className="text-sm font-semibold text-danger-text">
              Processing looks stalled.
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-danger-ink">
              This recording has been “processing” for over 15 minutes — the job was likely lost.
              Re-processing is safe and starts it over.
            </p>
            <div className="mt-2.5">
              <ReprocessButton id={source.id} />
            </div>
          </div>
        )}

        {/* Same banner shape as the KB's "awaiting approval" strip, so the hand-off reads as one
            control across both pages. */}
        <div className="flex flex-wrap items-center gap-3 rounded-tile border border-warning-border bg-warning-bg2 px-4 py-3.5">
          <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-warning-dot" />
          <p className="flex-1 text-[13px] leading-relaxed text-warning-text">
            <b className="font-semibold text-[#4a3e1e]">Extracted Workflows.</b>{' '}
            {candidates.length > 0
              ? `FlowBuddy extracted ${workflowCount} from this recording. Review and approve them for the copilot.`
              : source.status === 'ready' || source.status === 'done'
                ? 'No workflows were extracted from this recording.'
                : 'Workflows appear once processing finishes.'}
          </p>
          <Button asChild size="sm" className="shrink-0">
            <Link href={`/dashboard/kb?recording=${source.id}`}>
              Review &amp; approve workflows
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            {/* Replay */}
            <section className="space-y-2.5">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Summary</h2>
                {/* The summary is derived from the narration at build time (incl. product
                    explanation that isn't any workflow, e.g. pricing). Founder-facing only; the
                    replay note stands in until the recording has been processed. */}
                <div className="text-sm leading-relaxed text-muted-foreground">
                  <ClampedText
                    lines={2}
                    text={
                      source.description ||
                      'Replay your narration alongside the captured screenshots to see what FlowBuddy recorded. This is a reconstruction of the session, not a video.'
                    }
                  />
                </div>
              </div>
              {hasReplay ? (
                <RecordingPlayer
                  audioUrl={audioUrl}
                  durationMs={meta.durationMs}
                  frames={frames}
                />
              ) : (
                <div className="rounded-card border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing was captured to replay for this recording.
                </div>
              )}
            </section>

            {/* Extracted workflows — the KB list, scoped to this recording. Same component on
                purpose: approving here IS approving there, and a second list would drift. */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Extracted Workflows
                  <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                    {candidates.length}
                  </span>
                </h2>
                {(source.status === 'ready' || source.status === 'done') && candidates.length > 0 && (
                  <Button
                    size="sm"
                    variant="soft"
                    className="hover:border-primary hover:bg-primary hover:text-primary-foreground"
                    asChild
                  >
                    <Link href={`/dashboard/kb/${source.id}/reorganize`}>Reorganize</Link>
                  </Button>
                )}
              </div>
              {workflowRows.length > 0 ? (
                <KbWorkflowList workflows={workflowRows} readOnly />
              ) : (
                <div className="rounded-card border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                  {source.status === 'ready' || source.status === 'done'
                    ? 'No workflows were extracted from this recording.'
                    : 'Workflows appear once processing finishes.'}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="min-w-0 space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recording Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <dl className="space-y-1.5">
                  {summary.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-xs text-muted-foreground">{k}</dt>
                      <dd className="truncate text-right text-[12.5px] font-medium text-ink">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>


            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recording Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                {transcript?.text ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Click here to expand
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">
                      {transcript.text}
                    </p>
                  </details>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No transcript (no narration captured).
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Event timeline */}
            <section className="space-y-2.5">
              <h2 className="text-base font-semibold tracking-tight">
                Captured Actions
                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                  {events.length}
                </span>
              </h2>
              {events.length === 0 ? (
                <div className="rounded-card border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                  No actions were captured.
                </div>
              ) : (
                <RecordingActionsTimeline rows={timelineRows} />
              )}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
