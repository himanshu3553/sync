import type { CapturedEvent, Locator } from '@flowbuddy/shared';
import { eventLocators } from '@flowbuddy/shared/event-locators';
import { displayRoute, routePattern } from '@flowbuddy/shared/route-pattern';
import { eventVerb, isDestructive, slotFor, type ExecutionInputSlot, type ExecutionVerb } from './execution-plan';
import type { StepEvidence } from './step-evidence';

/**
 * The SOP compiler — the fourth derivation of a recording (beside the KB build, the execution
 * plan and the demo video): one approved workflow's distilled steps in, a document model out,
 * rendered as markdown for TWO readers by the two renderers below.
 *
 *  - `renderHumanSop` — a step-by-step guide a person follows by looking: prose + one annotated
 *    screenshot per step (the image itself is produced by sop-image.ts; this renderer only
 *    references it by the caller-supplied path).
 *  - `renderAgentSop` — a workflow manual for third-party AI agents (Claude Code / Codex-class):
 *    text only, deterministic layout, expected outcomes so an agent can self-verify each step,
 *    and an optional fenced machine layer (ranked locators) for DOM-driving consumers. This is
 *    the instructional/machine two-layer shape docs/build/interop.md §5 specifies — built here
 *    so Phase 6's transports (MCP, llms.txt) later render the same compiler.
 *
 * PURE by design, like execution-plan.ts: steps + events in, model and strings out, no I/O and
 * no clock (`compiledAt` arrives as input). Events are OPTIONAL — a step whose event is missing
 * still renders from its distilled text; knowledge tightens, absence never fails the document.
 *
 * Trust rules this file owns the enforcement of (the decisions live in interop.md):
 *  - Routes are never exported raw. The agent rendering patterns them (`routePattern`) and the
 *    human rendering elides them (`displayRoute`) — a recorded route is the founder's own URL,
 *    and an id in it is a real record out of their account.
 *  - Recorded input VALUES never appear. Input steps carry only the field's scrubbed label plus
 *    "value comes from your principal" (sensitive ones add the never-relay rule) — the same
 *    posture as the acting run and the P6 export schema.
 *
 * Tuning constants:
 *   SOP_MAX_LOCATORS = 6 — same cap and same reason as the execution plan and the sense plan.
 *   VERIFY_MARKERS_MAX = 3 — appeared-phrases quoted per step; enough to verify on, short enough
 *     that the manual stays a manual and not a DOM dump.
 */

export const SOP_MAX_LOCATORS = 6;
const VERIFY_MARKERS_MAX = 3;

/** The step fields the compiler needs out of `KnowledgeItem.data` (the distilled step shape) —
 *  a superset of what the execution plan reads, because an SOP also renders prose and images. */
export interface SopStepSource {
  instruction?: string;
  detail?: string | null;
  route?: string | null;
  keyEventId?: string | null;
  screenshotFile?: string | null;
  bbox?: { x: number; y: number; w: number; h: number } | null;
  evidence?: StepEvidence;
}

export interface SopInput {
  title: string;
  /** The workflow description — the PLAN (choices, optional parts). Verbatim founder-approved prose. */
  description?: string | null;
  steps: SopStepSource[];
  /** The recording's manifest events; optional — steps degrade to text-only without them. */
  events?: CapturedEvent[];
  /** ISO timestamp stamped into the agent rendering (the freshness rule, interop.md §5). */
  compiledAt: string;
}

export interface SopStep {
  /** 1-based, matching the step numbers Studio, answers and walkthroughs cite. */
  index: number;
  instruction: string;
  detail?: string;
  /** Patterned (`:id`) — safe for the agent rendering. '' when unknown. */
  route: string;
  /** Elided for human display. '' when unknown. */
  humanRoute: string;
  /** Absent when the step's event was unrecoverable or has no acting verb. */
  verb?: ExecutionVerb;
  /** Present on fill/select/check steps: what the reader must supply. Values are the principal's. */
  input?: ExecutionInputSlot;
  destructive?: boolean;
  /** Patterned landing route, only when the step navigates to a DIFFERENT screen. */
  navigatesTo?: string;
  expect?: { appeared?: string[]; disappeared?: string[]; landedTitle?: string };
  /** Ranked best-first, capped at SOP_MAX_LOCATORS; empty without a recoverable event. */
  locators: Locator[];
  hasImage: boolean;
}

export interface SopModel {
  title: string;
  goal?: string;
  /** First step's patterned route — the precondition line. Undefined when unknown. */
  entryRoute?: string;
  steps: SopStep[];
  compiledAt: string;
}

/** Compile one workflow's SOP model. Event recovery mirrors the sense plan and the execution plan
 *  (`keyEventId` first, screenshot-file match for legacy rows) — but here an unrecovered step is a
 *  DEGRADED step, never a failure: a document can still describe what a run could not drive. */
export function compileSop(input: SopInput): SopModel {
  const byId = new Map<string, CapturedEvent>();
  const byShot = new Map<string, CapturedEvent>();
  for (const ev of input.events ?? []) {
    byId.set(ev.id, ev);
    if (ev.screenshot?.file) byShot.set(ev.screenshot.file, ev);
    if (ev.postAction?.screenshot?.file) byShot.set(ev.postAction.screenshot.file, ev);
  }

  const steps: SopStep[] = input.steps.map((src, i) => {
    const ev =
      (src.keyEventId ? byId.get(src.keyEventId) : undefined) ??
      (src.screenshotFile ? byShot.get(src.screenshotFile) : undefined);

    const rawRoute = src.route ?? ev?.route?.path ?? '';
    const verb = ev ? eventVerb(ev) ?? undefined : undefined;

    // Same rule as both plan compilers: a landing route is only worth stating when the PATTERN
    // changes — /projects/123 → /projects/456 is the same screen.
    const landed = ev?.type === 'nav' ? ev.postAction?.route?.path ?? ev.route?.path : ev?.postAction?.route?.path;
    const navigatesTo =
      landed && routePattern(landed) !== routePattern(rawRoute) ? routePattern(landed) : undefined;

    const evd = src.evidence;
    const expect = {
      ...(evd?.appeared?.length ? { appeared: evd.appeared } : {}),
      ...(evd?.disappeared?.length ? { disappeared: evd.disappeared } : {}),
      ...(evd?.landedTitle ? { landedTitle: evd.landedTitle } : {}),
    };

    return {
      index: i + 1,
      instruction: src.instruction ?? '',
      ...(src.detail ? { detail: src.detail } : {}),
      route: rawRoute ? routePattern(rawRoute) : '',
      humanRoute: rawRoute ? displayRoute(rawRoute) : '',
      ...(verb ? { verb } : {}),
      ...(ev && (verb === 'fill' || verb === 'select' || verb === 'check') ? { input: slotFor(ev) } : {}),
      ...(ev && isDestructive(ev) ? { destructive: true } : {}),
      ...(navigatesTo ? { navigatesTo } : {}),
      ...(Object.keys(expect).length > 0 ? { expect } : {}),
      locators: ev && verb !== 'navigate' ? eventLocators(ev, SOP_MAX_LOCATORS) : [],
      hasImage: Boolean(src.screenshotFile),
    };
  });

  const entry = steps[0]?.route;
  return {
    title: input.title,
    ...(input.description ? { goal: input.description } : {}),
    ...(entry ? { entryRoute: entry } : {}),
    steps,
    compiledAt: input.compiledAt,
  };
}

// ── The human rendering ─────────────────────────────────────────────────────────────────────────

export interface HumanSopOptions {
  /** Relative path the markdown should reference for a step's annotated image (e.g.
   *  `images/step-01.png`). Called only for steps with `hasImage`. */
  imagePath?: (step: SopStep) => string;
}

/** Two-digit step stem shared with the zip builder so filenames and references cannot drift. */
export function sopImageName(step: SopStep): string {
  return `step-${String(step.index).padStart(2, '0')}.png`;
}

export function renderHumanSop(model: SopModel, opts: HumanSopOptions = {}): string {
  const lines: string[] = [];
  lines.push(`# ${model.title}`);
  lines.push('');
  lines.push('_A step-by-step guide, generated by FlowBuddy from a recorded workflow._');
  if (model.goal) {
    lines.push('');
    lines.push(model.goal);
  }
  lines.push('');
  lines.push('## Steps');
  for (const step of model.steps) {
    lines.push('');
    lines.push(`### Step ${step.index} — ${step.instruction}`);
    if (step.humanRoute) lines.push(`_On \`${step.humanRoute}\`_`);
    if (step.detail) {
      lines.push('');
      lines.push(step.detail);
    }
    if (step.destructive) {
      lines.push('');
      lines.push('> ⚠️ This action takes effect immediately — double-check before you confirm.');
    }
    if (step.hasImage && opts.imagePath) {
      lines.push('');
      lines.push(`![Step ${step.index} — ${step.instruction}](${opts.imagePath(step)})`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

// ── The agent rendering ─────────────────────────────────────────────────────────────────────────

export interface AgentSopOptions {
  /** Include the per-step fenced machine layer (ranked locators) for DOM-driving consumers.
   *  Off by default: pixel/reasoning agents use instructions, routes and outcomes. */
  machineLayer?: boolean;
}

export function renderAgentSop(model: SopModel, opts: AgentSopOptions = {}): string {
  const lines: string[] = [];
  lines.push(`# ${model.title}`);
  lines.push('');
  lines.push('> A workflow manual for AI agents, generated by FlowBuddy from a recorded,');
  lines.push('> founder-approved workflow.');
  lines.push(`> Compiled: ${model.compiledAt}`);
  lines.push('> Values for input fields always come from your principal — never from this document.');
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push(model.goal ?? `Complete the "${model.title}" workflow in the application.`);
  lines.push('');
  lines.push('## Preconditions');
  lines.push('');
  lines.push(
    model.entryRoute
      ? `- Start at route \`${model.entryRoute}\` (routes are patterns — an \`:id\` segment stands for a record id from your own context).`
      : '- The starting screen was not recorded — begin from wherever the application offers this task.',
  );
  // Conditional on purpose: a sign-up/sign-in workflow is its own precondition — asserting an
  // authenticated session there would be false, and an agent takes preconditions literally.
  lines.push('- Where the task requires it, an authenticated session in the application is assumed.');
  lines.push('');
  lines.push('## Steps');
  for (const step of model.steps) {
    lines.push('');
    lines.push(`### ${step.index}. ${step.instruction}`);
    if (step.route) lines.push(`- Route: \`${step.route}\``);
    if (step.detail) lines.push(`- Context: ${step.detail}`);
    if (step.verb) {
      const inputNote = step.input
        ? ` — value comes from your principal (field: "${step.input.label}")`
        : '';
      lines.push(`- Action: ${step.verb}${inputNote}`);
    }
    if (step.input?.sensitive) {
      lines.push(
        '- Sensitive input: the principal must enter this value directly — never relay it through chat, logs, or this document.',
      );
    }
    if (step.destructive) {
      lines.push('- Destructive: confirm with your principal before performing this step.');
    }
    const verify: string[] = [];
    for (const phrase of (step.expect?.appeared ?? []).slice(0, VERIFY_MARKERS_MAX)) {
      verify.push(`"${phrase}" appears`);
    }
    if (step.expect?.landedTitle) verify.push(`the page title becomes "${step.expect.landedTitle}"`);
    if (step.navigatesTo) verify.push(`the route becomes \`${step.navigatesTo}\``);
    if (verify.length > 0) lines.push(`- Verify: ${verify.join(' · ')}`);
    if (opts.machineLayer && step.locators.length > 0) {
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify({ locators: step.locators }));
      lines.push('```');
    }
  }
  lines.push('');
  return lines.join('\n');
}
