'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@flowbuddy/db';
import { getCurrentWorkspace } from '@/lib/session';

/**
 * Help-portal actions (portal track slice 2). Two levels, matching the trust model:
 *  - the WORKSPACE switch (`portalEnabled`) — the master gate; enabling requires the recorded
 *    screenshot acknowledgment (`portalAcceptedAt`, stamped once, kept across disable/enable);
 *  - per-WORKFLOW publication — a `PortalPublication` row keyed on workflow identity, with the
 *    founder-assigned category riding it (presentation data, not KB structure).
 *
 * Every mutation revalidates the public portal's layout path so ISR pages regenerate immediately —
 * publish/unpublish must be visible on the next request, not at the cache window.
 */

const CATEGORY_MAX = 40;

function cleanCategory(category: string | null | undefined): string | null {
  const c = (category ?? '').trim().slice(0, CATEGORY_MAX);
  return c.length > 0 ? c : null;
}

async function revalidatePortal(slug: string): Promise<void> {
  revalidatePath(`/help/${slug}`, 'layout');
}

export async function setPortalEnabled(input: { enabled: boolean; acknowledged?: boolean }): Promise<void> {
  const ctx = await getCurrentWorkspace();
  if (!ctx) throw new Error('Not authenticated');
  const ws = await prisma.workspace.findUnique({
    where: { id: ctx.workspace.id },
    select: { slug: true, portalAcceptedAt: true },
  });
  if (!ws) throw new Error('Workspace not found');

  if (input.enabled && !ws.portalAcceptedAt && !input.acknowledged) {
    // The UI always shows the dialog before calling with acknowledged: true; this is the backstop.
    throw new Error('The screenshot acknowledgment is required to enable the portal.');
  }

  await prisma.workspace.update({
    where: { id: ctx.workspace.id },
    data: {
      portalEnabled: input.enabled,
      ...(input.enabled && !ws.portalAcceptedAt ? { portalAcceptedAt: new Date() } : {}),
    },
  });

  await revalidatePortal(ws.slug);
  revalidatePath('/dashboard/portal');
}

export async function setPortalPublication(input: {
  workflowId: string;
  published: boolean;
  category?: string | null;
}): Promise<void> {
  const ctx = await getCurrentWorkspace();
  if (!ctx) throw new Error('Not authenticated');
  const workspaceId = ctx.workspace.id;

  // Ownership + identity in one read — same rule as approvals: publish the workflow row, never
  // whatever sits at a position.
  const workflow = await prisma.workflow.findFirst({
    where: { id: input.workflowId, workspaceId },
    select: { id: true, sourceId: true },
  });
  if (!workflow) throw new Error('Workflow not found');

  if (input.published) {
    const category = cleanCategory(input.category);
    await prisma.portalPublication.upsert({
      where: { workflowId: workflow.id },
      create: { workspaceId, workflowId: workflow.id, category, publishedById: ctx.userId },
      update: { category, publishedById: ctx.userId },
    });
  } else {
    await prisma.portalPublication.deleteMany({ where: { workspaceId, workflowId: workflow.id } });
  }

  await revalidatePortal(ctx.workspace.slug);
  revalidatePath(`/dashboard/kb/${workflow.sourceId}`);
  revalidatePath('/dashboard/portal');
}

/**
 * Publish MANY workflows in one round-trip + one transaction — the Help Portal page's "Add guides"
 * dialog. Same shape and reason as the approvals bulk action: a client-side loop of N server
 * actions stalls the transition and exhausts free-tier DB connections.
 */
export async function setPortalPublicationsBulk(input: {
  workflowIds: string[];
  category?: string | null;
}): Promise<void> {
  const ctx = await getCurrentWorkspace();
  if (!ctx) throw new Error('Not authenticated');
  const workspaceId = ctx.workspace.id;
  if (input.workflowIds.length === 0) return;

  // Ownership in one read; anything not the workspace's own is silently not in this list.
  const workflows = await prisma.workflow.findMany({
    where: { id: { in: input.workflowIds }, workspaceId },
    select: { id: true },
  });
  const category = cleanCategory(input.category);
  await prisma.$transaction(
    workflows.map((w) =>
      prisma.portalPublication.upsert({
        where: { workflowId: w.id },
        create: { workspaceId, workflowId: w.id, category, publishedById: ctx.userId },
        update: { category, publishedById: ctx.userId },
      }),
    ),
  );

  await revalidatePortal(ctx.workspace.slug);
  revalidatePath('/dashboard/portal');
}

/** Rename a category across every publication carrying it (categories are free text on the rows —
 *  a rename IS a grouped update). An empty new name moves the group to General (null). */
export async function renamePortalCategory(input: {
  from: string | null;
  to: string | null;
}): Promise<void> {
  const ctx = await getCurrentWorkspace();
  if (!ctx) throw new Error('Not authenticated');
  await prisma.portalPublication.updateMany({
    where: { workspaceId: ctx.workspace.id, category: cleanCategory(input.from) },
    data: { category: cleanCategory(input.to) },
  });
  await revalidatePortal(ctx.workspace.slug);
  revalidatePath('/dashboard/portal');
}
