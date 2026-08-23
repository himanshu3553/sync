import type { Candidate } from '@/lib/candidates';
import { duplicatesByWorkflow, type WorkflowOverlap } from '@/lib/overlaps';
import type { OverlapView } from '@/components/dashboard/duplicate-workflows';
import type { WorkflowRow } from '@/components/dashboard/kb-workflow-list';

// The candidate → `KbWorkflowList` row mapping, shared by the Knowledge Base page and a recording's
// own "Extracted Workflows" section. Extracted at the second consumer.

/** Dates cross the server→client boundary as strings; the view only ever renders them. */
export function toOverlapView(o: WorkflowOverlap): OverlapView {
  return {
    similarity: o.similarity,
    incumbent: { ...o.incumbent, approvedAt: o.incumbent.approvedAt?.toISOString() ?? null },
    challenger: { ...o.challenger, approvedAt: o.challenger.approvedAt?.toISOString() ?? null },
  };
}

export function toWorkflowRows(
  candidates: Candidate[],
  overlaps: WorkflowOverlap[],
): WorkflowRow[] {
  const byWorkflow = duplicatesByWorkflow(overlaps);
  return candidates.map((c) => ({
    workflowId: c.workflowId,
    sourceId: c.sourceId,
    segmentIndex: c.segmentIndex,
    segmentTitle: c.segmentTitle,
    itemCount: c.itemCount,
    sourceTitle: c.sourceTitle,
    description: c.description,
    copilotApproved: c.copilotApproved,
    inactiveReason: c.inactiveReason,
    supersededByTitle: c.supersededByTitle ?? null,
    duplicates: (byWorkflow.get(`${c.sourceId}:${c.segmentIndex}`) ?? []).map(toOverlapView),
  }));
}
