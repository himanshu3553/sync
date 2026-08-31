import { cache } from 'react';
import { prisma } from '@flowbuddy/db';
import type { SessionManifest } from '@flowbuddy/shared';
import { renderAgentSop } from '@flowbuddy/synthesis/sop';
import { COPILOT_DEFAULTS } from '@/lib/copilot-appearance';
import { loadWorkflowSop } from '@/lib/sop';
import { signedUrl, sessionObjectKey } from '@/lib/storage';
import type { Bbox, Viewport } from '@/lib/bbox-style';

/**
 * Public help-portal data — the portal track's serving layer (slice 2). Everything here is read by
 * PUBLIC, unauthenticated pages, so the rules are the trust model's, not the dashboard's:
 *
 *  - The workspace gate: `portalEnabled` must be on, or the whole portal 404s — publications alone
 *    expose nothing (nothing is public by default).
 *  - Fail-closed per workflow: only publications whose workflow is still ATTACHED
 *    (`segmentIndex != null` — its content is verified to be what existed when the founder
 *    published) and still HAS steps are served. A reprocess that detaches a workflow silently
 *    removes its article; the publication row survives for when a human re-settles it.
 *  - Only the founder's layer leaves: title, description, step instruction/detail, screenshots.
 *    No routes, no ids in URLs beyond the short workflow-id suffix, no locators.
 *
 * Loaders are wrapped in React `cache()` so the layout, page and metadata functions share one
 * query per request. Pages using these are ISR-cached (`revalidate`) and revalidated on publish.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

export interface PortalArticleRef {
  workflowId: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  stepCount: number;
  hasVideo: boolean;
  publishedAt: Date;
}

export interface PortalWorkspace {
  id: string;
  name: string;
  slug: string;
  /** Sanitized hex — the copilot accent reused as the portal accent (one brand setting). */
  accent: string;
  /** The founder's product URL (from the newest recording's capture manifest), when known. */
  productUrl: string | null;
  demoVideosEnabled: boolean;
}

export interface PortalData {
  workspace: PortalWorkspace;
  articles: PortalArticleRef[];
  /** Category names in first-published order, "General" last when present. */
  categories: string[];
}

export const GENERAL_CATEGORY = 'General';

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'guide'
  );
}

/** `<title-slug>-<short-id>`: readable + SEO-friendly, stable through title edits — the trailing
 *  8-char workflow-id suffix is what actually resolves; a changed title 301s to the new canonical. */
export function articleSlug(title: string | null, workflowId: string): string {
  return `${slugify(title ?? 'guide')}-${workflowId.slice(-8)}`;
}

export function articleIdSuffix(slug: string): string | null {
  const m = /-([a-z0-9]{8})$/.exec(slug);
  return m ? m[1]! : null;
}

export const getPortal = cache(async (slug: string): Promise<PortalData | null> => {
  const ws = await prisma.workspace.findFirst({
    where: { slug, portalEnabled: true },
    select: { id: true, name: true, slug: true, copilotAccent: true, demoVideosEnabled: true },
  });
  if (!ws) return null;

  const pubs = await prisma.portalPublication.findMany({
    where: {
      workspaceId: ws.id,
      // Fail-closed: an attached workflow only (see the header). Steps are checked below.
      workflow: { segmentIndex: { not: null } },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      category: true,
      createdAt: true,
      workflow: {
        select: {
          id: true,
          title: true,
          description: true,
          _count: { select: { items: { where: { kind: 'step' } } } },
          demoVideo: { select: { status: true } },
          items: { where: { kind: 'step' }, take: 1, select: { segmentTitle: true } },
        },
      },
    },
  });

  const articles: PortalArticleRef[] = pubs
    .filter((p) => p.workflow._count.items > 0)
    .map((p) => {
      const title = p.workflow.title ?? p.workflow.items[0]?.segmentTitle ?? 'Untitled guide';
      return {
        workflowId: p.workflow.id,
        slug: articleSlug(title, p.workflow.id),
        title,
        description: p.workflow.description,
        category: p.category?.trim() || GENERAL_CATEGORY,
        stepCount: p.workflow._count.items,
        hasVideo: ws.demoVideosEnabled && p.workflow.demoVideo?.status === 'ready',
        publishedAt: p.createdAt,
      };
    });

  const categories = [...new Set(articles.map((a) => a.category))].sort((a, b) =>
    a === GENERAL_CATEGORY ? 1 : b === GENERAL_CATEGORY ? -1 : 0,
  );

  // The founder's product URL — the newest ready recording's capture origin.
  const latest = await prisma.knowledgeSource.findFirst({
    where: { workspaceId: ws.id, status: { in: ['ready', 'done'] } },
    orderBy: { createdAt: 'desc' },
    select: { manifest: true },
  });
  const baseUrl = (latest?.manifest as unknown as SessionManifest | null)?.app?.baseUrl ?? null;
  let productUrl: string | null = null;
  if (baseUrl) {
    try {
      productUrl = new URL(baseUrl).origin;
    } catch {
      productUrl = null;
    }
  }

  return {
    workspace: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      accent: ws.copilotAccent && HEX.test(ws.copilotAccent.trim()) ? ws.copilotAccent.trim() : COPILOT_DEFAULTS.accent,
      productUrl,
      demoVideosEnabled: ws.demoVideosEnabled,
    },
    articles,
    categories,
  };
});

export interface PortalArticleStep {
  number: number;
  instruction: string;
  detail: string;
  screenshotUrl: string | null;
  bbox: Bbox | null;
}

export interface PortalArticle {
  ref: PortalArticleRef;
  steps: PortalArticleStep[];
  viewport: Viewport | null;
  videoUrl: string | null;
}

/** Signed-URL lifetime. Deliberately far above the pages' ISR window: a cached page must never
 *  outlive the URLs baked into it (stale-while-revalidate can serve one stale hit past the window). */
const PORTAL_ASSET_URL_TTL_S = 21_600;

// The distilled-step fields the article renders (the same KnowledgeItem.data shape the KB page reads).
type StepData = {
  instruction?: string;
  detail?: string;
  screenshotFile?: string | null;
  bbox?: Bbox | null;
};

export const getPortalArticle = cache(
  async (portalSlug: string, slug: string): Promise<{ portal: PortalData; article: PortalArticle } | null> => {
    const portal = await getPortal(portalSlug);
    if (!portal) return null;
    const suffix = articleIdSuffix(slug);
    if (!suffix) return null;
    const ref = portal.articles.find((a) => a.workflowId.endsWith(suffix));
    if (!ref) return null;

    const workflow = await prisma.workflow.findFirst({
      where: { id: ref.workflowId, workspaceId: portal.workspace.id },
      select: {
        sourceId: true,
        source: { select: { manifest: true } },
        items: {
          where: { kind: 'step' },
          orderBy: { orderIndex: 'asc' },
          select: { data: true, text: true, orderIndex: true },
        },
        demoVideo: { select: { status: true, fileKey: true } },
      },
    });
    if (!workflow || workflow.items.length === 0) return null;

    const viewport =
      (workflow.source.manifest as unknown as SessionManifest | null)?.app?.viewport ?? null;

    const steps: PortalArticleStep[] = await Promise.all(
      workflow.items.map(async (it, i) => {
        const d = (it.data ?? {}) as StepData;
        return {
          number: i + 1,
          instruction: d.instruction ?? it.text,
          detail: d.detail ?? '',
          screenshotUrl: d.screenshotFile
            ? await signedUrl(
                sessionObjectKey(portal.workspace.id, workflow.sourceId, d.screenshotFile),
                PORTAL_ASSET_URL_TTL_S,
              )
            : null,
          bbox: d.bbox ?? null,
        };
      }),
    );

    const videoUrl =
      ref.hasVideo && workflow.demoVideo?.fileKey
        ? await signedUrl(workflow.demoVideo.fileKey, PORTAL_ASSET_URL_TTL_S)
        : null;

    return { portal, article: { ref, steps, viewport, videoUrl } };
  },
);

/** The portal's public base URL (canonical, sitemap, OG). */
export function portalBaseUrl(): string {
  return (process.env.FLOWBUDDY_STUDIO_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * The agent door (slice 3): a published article's AI-agent manual — the same `renderAgentSop`
 * output the Studio's SOP card downloads, served at the article's `.md` sibling URL. Same gates as
 * the human page (portal on → published → attached → has steps), because `getPortal` is the same
 * gate; text-only by construction, so nothing pixel-shaped rides this path.
 */
export const getPortalAgentMarkdown = cache(
  async (
    portalSlug: string,
    slug: string,
  ): Promise<{ canonicalSlug: string; markdown: string } | null> => {
    const portal = await getPortal(portalSlug);
    if (!portal) return null;
    const suffix = articleIdSuffix(slug);
    if (!suffix) return null;
    const ref = portal.articles.find((a) => a.workflowId.endsWith(suffix));
    if (!ref) return null;

    const workflow = await prisma.workflow.findFirst({
      where: { id: ref.workflowId, workspaceId: portal.workspace.id, segmentIndex: { not: null } },
      select: { sourceId: true, segmentIndex: true },
    });
    if (!workflow || workflow.segmentIndex == null) return null;

    const sop = await loadWorkflowSop(portal.workspace.id, workflow.sourceId, workflow.segmentIndex);
    if (!sop) return null;

    const humanUrl = `${portalBaseUrl()}/help/${portal.workspace.slug}/${ref.slug}`;
    const markdown = `${renderAgentSop(sop.model)}\n---\n\nHuman-readable version (with screenshots): ${humanUrl}\nAll guides for this product: ${portalBaseUrl()}/help/${portal.workspace.slug}/llms.txt\n`;
    return { canonicalSlug: ref.slug, markdown };
  },
);
