import { prisma } from '@flowbuddy/db';
import type { SessionManifest } from '@flowbuddy/shared';
import { compileSop, type SopModel, type SopStepSource } from '@flowbuddy/synthesis/sop';

/**
 * Load + compile ONE workflow's SOP — the shared half of the KB page's SOP card (which previews
 * the agent rendering) and the download route (which also renders the annotated images). COMPUTES
 * ONLY, stores nothing: markdown is cheap, so an SOP is compiled on request and founder edits are
 * reflected instantly — the video's stored-artifact/staleness machinery is deliberately absent.
 */
export interface LoadedSop {
  workflowId: string;
  title: string;
  model: SopModel;
  /** The raw step sources, aligned with `model.steps` by index — the zip builder needs each
   *  step's screenshotFile + bbox, which the pure model deliberately does not carry. */
  sources: SopStepSource[];
  viewport: { w: number; h: number } | null;
}

export async function loadWorkflowSop(
  workspaceId: string,
  sourceId: string,
  segmentIndex: number,
): Promise<LoadedSop | null> {
  const workflow = await prisma.workflow.findFirst({
    where: { workspaceId, sourceId, segmentIndex },
    select: { id: true, description: true },
  });
  if (!workflow) return null;

  const [items, source] = await Promise.all([
    prisma.knowledgeItem.findMany({
      where: { workspaceId, workflowId: workflow.id, kind: 'step' },
      orderBy: { orderIndex: 'asc' },
      select: { data: true, text: true, segmentTitle: true },
    }),
    prisma.knowledgeSource.findUnique({
      where: { id: sourceId },
      select: { manifest: true },
    }),
  ]);
  if (items.length === 0) return null;

  const manifest = source?.manifest as unknown as SessionManifest | null;
  const title =
    items.find((it) => it.segmentTitle)?.segmentTitle ?? `Workflow ${segmentIndex + 1}`;
  const sources = items.map((it) => {
    const d = (it.data ?? {}) as SopStepSource;
    // Distilled instruction, falling back to the searchable text — the same rule the KB page renders by.
    return { ...d, instruction: d.instruction ?? it.text };
  });

  const model = compileSop({
    title,
    description: workflow.description,
    steps: sources,
    events: manifest?.events,
    compiledAt: new Date().toISOString(),
  });
  return {
    workflowId: workflow.id,
    title,
    model,
    sources,
    viewport: manifest?.app?.viewport ?? null,
  };
}

/** Filesystem-safe stem for SOP downloads, from the workflow title. */
export function sopFileStem(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'workflow-sop';
}
