import { strToU8, zipSync, type Zippable } from 'fflate';
import { getCurrentWorkspace } from '@/lib/session';
import { loadWorkflowSop, sopFileStem } from '@/lib/sop';
import { artifactReader } from '@/lib/storage';
import { renderAgentSop, renderHumanSop, sopImageName } from '@flowbuddy/synthesis/sop';
import { renderSopStepImage } from '@flowbuddy/synthesis/sop-image';

/**
 * SOP downloads for one workflow — compiled on request (nothing stored, so founder edits are
 * always reflected; see lib/sop.ts). Two kinds, one compiler:
 *   ?kind=agent — the text-only AI-agent manual as a single .md
 *   ?kind=guide — the human guide: a .zip of sop.md + one annotated PNG per step
 * Founder-facing like the demo video: their own recording, behind the Studio session — the
 * public/portal surface is Slice 2 and gates separately.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentWorkspace();
  if (!ctx) return new Response('Unauthorized', { status: 401 });

  const { id: sourceId } = await params;
  const q = new URL(req.url).searchParams;
  const wf = Number(q.get('wf'));
  if (!Number.isInteger(wf) || wf < 0) return new Response('Bad request', { status: 400 });
  const kind = q.get('kind') === 'agent' ? 'agent' : 'guide';

  // Workspace-scoped by the query itself — a foreign sourceId resolves to nothing.
  const sop = await loadWorkflowSop(ctx.workspace.id, sourceId, wf);
  if (!sop) return new Response('Not found', { status: 404 });
  const stem = sopFileStem(sop.title);

  if (kind === 'agent') {
    return new Response(renderAgentSop(sop.model), {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${stem}-ai-agent.md"`,
        'cache-control': 'no-store',
      },
    });
  }

  // The guide zip. Images render best-effort: a screenshot missing from storage degrades that
  // step to text (hasImage flipped off so the markdown never references a file the zip lacks) —
  // one lost JPEG should not kill the document, the same posture as the video builder.
  const read = artifactReader(ctx.workspace.id, sourceId);
  const files: Zippable = {};
  const steps = await Promise.all(
    sop.model.steps.map(async (step) => {
      const file = sop.sources[step.index - 1]?.screenshotFile;
      if (!step.hasImage || !file || !sop.viewport) return { ...step, hasImage: false };
      const screenshot = await read(file);
      if (!screenshot) return { ...step, hasImage: false };
      try {
        const png = await renderSopStepImage({
          screenshot,
          viewport: sop.viewport,
          bbox: sop.sources[step.index - 1]?.bbox ?? null,
        });
        // PNGs are already compressed — store, don't deflate again.
        files[`images/${sopImageName(step)}`] = [new Uint8Array(png), { level: 0 }];
        return step;
      } catch {
        return { ...step, hasImage: false };
      }
    }),
  );
  const markdown = renderHumanSop(
    { ...sop.model, steps },
    { imagePath: (s) => `images/${sopImageName(s)}` },
  );
  files['sop.md'] = strToU8(markdown);

  const zip = zipSync(files);
  return new Response(new Uint8Array(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${stem}-sop.zip"`,
      'cache-control': 'no-store',
    },
  });
}
