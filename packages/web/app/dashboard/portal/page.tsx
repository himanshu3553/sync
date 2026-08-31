import { redirect } from 'next/navigation';
import { prisma } from '@flowbuddy/db';
import { getCurrentWorkspace } from '@/lib/session';
import { articleSlug, portalBaseUrl } from '@/lib/portal';
import { signedUrl, sessionObjectKey } from '@/lib/storage';
import { PageHeader } from '@/components/dashboard/page-header';
import { PortalSettingsCard } from '@/components/dashboard/portal-settings-card';
import { PortalGuides, type PortalGuideRow } from '@/components/dashboard/portal-guides';
import { PortalAddGuides, type PortalCandidate } from '@/components/dashboard/portal-add-guides';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/**
 * The Help Portal manager — the ONE Studio home for everything portal (the Settings card moved
 * here when this page arrived): the switch + acknowledgment, the public and agent URLs, every
 * published guide grouped by category, and the add-guides flow that publishes straight from the
 * Knowledge Base without visiting each workflow page.
 *
 * The status column is the important part: the portal FAILS CLOSED (a workflow detached by a
 * reprocess, or one with no steps, silently stops serving) — this page is the only surface that
 * SAYS so, as "Hidden — needs re-review", so a vanished article is a visible state instead of a
 * mystery.
 */

// The distilled-step fields the thumbnail needs (the same KnowledgeItem.data shape everywhere).
type StepData = { screenshotFile?: string | null };

export default async function PortalPage() {
  const ctx = await getCurrentWorkspace();
  if (!ctx) redirect('/signin');
  const workspaceId = ctx.workspace.id;
  const base = `${portalBaseUrl()}/help/${ctx.workspace.slug}`;

  const [publications, candidates] = await Promise.all([
    prisma.portalPublication.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        category: true,
        createdAt: true,
        workflow: {
          select: {
            id: true,
            title: true,
            segmentIndex: true,
            sourceId: true,
            _count: { select: { items: { where: { kind: 'step' } } } },
            demoVideo: { select: { status: true } },
            items: {
              where: { kind: 'step' },
              orderBy: { orderIndex: 'asc' },
              take: 1,
              select: { segmentTitle: true, data: true },
            },
          },
        },
      },
    }),
    // Publish candidates: ready, attached, with steps, not yet on the portal.
    prisma.workflow.findMany({
      where: {
        workspaceId,
        segmentIndex: { not: null },
        portalPublication: null,
        source: { status: { in: ['ready', 'done'] } },
        items: { some: { kind: 'step' } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        items: {
          where: { kind: 'step' },
          orderBy: { orderIndex: 'asc' },
          take: 1,
          select: { segmentTitle: true },
        },
        source: { select: { title: true, generatedTitle: true } },
      },
    }),
  ]);

  const rows: PortalGuideRow[] = await Promise.all(
    publications.map(async (p) => {
      const w = p.workflow;
      const title = w.title ?? w.items[0]?.segmentTitle ?? 'Untitled guide';
      const live = w.segmentIndex != null && w._count.items > 0;
      const shot = (w.items[0]?.data as StepData | null)?.screenshotFile;
      return {
        workflowId: w.id,
        title,
        category: p.category,
        stepCount: w._count.items,
        hasVideo: ctx.workspace.demoVideosEnabled && w.demoVideo?.status === 'ready',
        publishedAt: p.createdAt.toISOString(),
        live,
        articleUrl: live && ctx.workspace.portalEnabled ? `${base}/${articleSlug(title, w.id)}` : null,
        kbHref: `/dashboard/kb/${w.sourceId}${w.segmentIndex != null ? `?wf=${w.segmentIndex}` : ''}`,
        thumbnailUrl: shot
          ? await signedUrl(sessionObjectKey(workspaceId, w.sourceId, shot))
          : null,
      };
    }),
  );

  const candidateRows: PortalCandidate[] = candidates.map((w) => ({
    workflowId: w.id,
    title: w.title ?? w.items[0]?.segmentTitle ?? 'Untitled workflow',
    recording: w.source.title ?? w.source.generatedTitle ?? 'Untitled recording',
  }));

  const categories = [...new Set(rows.map((r) => r.category).filter((c): c is string => c != null))].sort();

  return (
    <>
      <PageHeader
        title="Help Portal"
        subtitle="Your public help center — workflows published as guides for your users, and as manuals for AI agents."
      />
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Portal</CardTitle>
            <CardDescription className="text-xs">
              One public site per workspace. Nothing is public until you switch it on, and only the
              guides you publish appear.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PortalSettingsCard
              enabled={ctx.workspace.portalEnabled}
              accepted={ctx.workspace.portalAcceptedAt != null}
              portalUrl={base}
              publishedCount={rows.length}
              agentIndexUrl={ctx.workspace.portalEnabled ? `${base}/llms.txt` : null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">Published guides</CardTitle>
                <CardDescription className="text-xs">
                  Grouped by category. Articles render live from the Knowledge Base — founder edits
                  show up immediately, nothing goes stale.
                </CardDescription>
              </div>
              <PortalAddGuides candidates={candidateRows} categorySuggestions={categories} />
            </div>
          </CardHeader>
          <CardContent>
            <PortalGuides rows={rows} categorySuggestions={categories} portalEnabled={ctx.workspace.portalEnabled} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
