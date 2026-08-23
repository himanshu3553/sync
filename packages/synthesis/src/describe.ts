import OpenAI from 'openai';
import { redactText } from './redact';
import { structuredJsonCall } from './responses';
import type { DistilledStep } from './distill';

/**
 * Write ONE workflow's PLAN in prose — what the task achieves, what is optional, what has to be true
 * before you start.
 *
 * WHY THIS EXISTS AT ALL. A recording is a list of actions, so distilled steps can only ever say
 * what to click, in the order it was clicked. They structurally cannot express *"you only need one
 * of these"* — which is not a gap in the distiller's prompt but in the shape it must emit. In task
 * analysis the steps and the **plan** are two different artefacts for exactly this reason: the steps
 * come from watching, the plan comes from the person. Here the plan is in the narration, and this is
 * the only thing that reads it for that.
 *
 * The live failure it fixes: a chatbot workflow answered as ten mandatory steps when three of them
 * were "upload a document, or add a website URL, or both".
 *
 * WHY A SEPARATE CALL, AFTER DISTILLATION.
 *  · The distiller is good at producing clean steps; asking it to also write prose divides its
 *    attention on the thing it is already good at, and step quality is the foundation everything
 *    else stands on.
 *  · Writing this AFTER distillation means it sees the FINAL steps. It cannot describe a step that
 *    was dropped, and it cannot drift from wording that has already been settled.
 *  · It still needs the full transcript, because the plan is only ever in what the founder SAID.
 *    Steps alone would produce a summary of the clicks — which is the one thing already covered.
 *
 * Build-time only, once per workflow, never on the answer path.
 *
 * ⚠️ THIS IS MODEL OUTPUT ENTERING APPROVED KNOWLEDGE. Steps are anchored — every one cites a real
 * captured event, and the distiller is validated against those ids. Prose has no such anchor, which
 * is why Studio must show it wherever a workflow is approved. Without that, approval silently stops
 * covering everything the copilot may say.
 */

const MAX_TRANSCRIPT_CHARS = 10_000; // ~12 min of speech — and trimmed from the FRONT, see keepTail
const MAX_DESCRIPTION_CHARS = 900; // a plan, not a retelling — see the prompt's length rule

// The recording-level call reads the WHOLE tour once per recording (not per workflow), so its
// window is wide where the workflow describer's is narrow.
const MAX_RECORDING_TRANSCRIPT_CHARS = 24_000;
const MAX_RECORDING_DESCRIPTION_CHARS = 600; // a coverage line for the recordings list, not an article
const MAX_RECORDING_TITLE_CHARS = 80; // a list-row name — the founder's own Rename is capped at 120

const SYSTEM = `You write ONE short paragraph describing a product workflow, for an in-app help copilot that ALSO has the workflow's exact steps.

You get the workflow's title, its final user-facing steps, and the full narration transcript from the recording.

Describe the PLAN — what the user is accomplishing and how the parts relate:
- What the task achieves, in the user's own terms.
- What is OPTIONAL, what is a CHOICE between alternatives, and whether they may do more than one of them. This is the most valuable thing you can capture, and it is usually only in the narration ("you can either…", "or you can just…", "you don't have to…", "instead of that…").
- SETTINGS the narration presents as the reader's own decision ("you can enable or disable this", "for now I'm just keeping it on") — say what the choice is and what it changes for them. NEVER say which way the recorder left it: that setting changes how the product behaves for whoever is following, and it is theirs to make, not a step to copy.
- Anything required BEFORE starting, and anything that happens after (waiting, processing, a result to check).

Hard rules:
- NEVER restate a click target, a button name, a field name, or a step number. The copilot already has the steps and shows them separately. If your sentence could be mistaken for an instruction, rewrite it.
- NEVER reproduce a specific value from the recording — a project name, a bot name, a title, a URL, a filename, a person's name. Those are the recorder's own sample data, entered in their own account. Describe the KIND of thing that is needed instead.
- Use ONLY the steps and the narration. NEVER add features, options, or behaviour from general knowledge about similar products — if the narration doesn't say it, it does not exist.
- If the narration reveals nothing beyond the steps themselves, write a plain one-sentence summary of the goal. A short honest description is correct; an invented one is not.
- Plain prose, no lists, no markdown, no heading. Two to four sentences.
- Write about the user ("you"), not about the recording.`;

const schema = {
  name: 'workflow_description',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { title: { type: 'string' }, description: { type: 'string' } },
    required: ['title', 'description'],
  },
} as const;

/**
 * Keep the LAST `max` characters, not the first.
 *
 * The narration handed to `describeWorkflow` is the workflow's RUN-UP (align.ts) — everything said
 * since the previous workflow's last click, which for the first workflow of a tour includes however
 * long the founder spent explaining the product before touching anything. So the front of that string
 * is the oldest set-up talk and the back is the words spoken closest to the clicks, about THIS task.
 *
 * Trimming from the back would therefore feed the describer a concept explanation and cut the task's
 * own narration off the end — the whole-tape bug, recreated inside a single workflow. Trimming from
 * the front keeps the task's own words unconditionally and as much preamble as still fits.
 *
 * Snaps forward to whitespace so the window never opens mid-word.
 */
export function keepTail(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(t.length - max);
  const sp = cut.search(/\s/);
  return (sp > 0 ? cut.slice(sp + 1) : cut).trim();
}

/**
 * Returns the description, or `null` when there is nothing worth describing.
 *
 * Unlike the rest of the pipeline this is BEST-EFFORT and swallows its failure: a workflow without a
 * description is the status quo — steps still answer, exactly as they do today — so a model blip
 * must not fail a recording that otherwise processed perfectly. That is the opposite of the
 * distiller, where a silent failure would write a wrong knowledge base.
 */
export async function describeWorkflow(
  openai: OpenAI,
  model: string,
  title: string,
  steps: DistilledStep[],
  transcriptText: string,
): Promise<string | null> {
  if (steps.length === 0) return null;

  const stepList = steps
    .map((s, i) => `${i + 1}. ${s.instruction}${s.detail ? ` — ${s.detail}` : ''}`)
    .join('\n');
  const user = [
    `WORKFLOW: ${title}`,
    '',
    'STEPS (final, user-facing):',
    stepList,
    '',
    'NARRATION TRANSCRIPT:',
    keepTail(transcriptText, MAX_TRANSCRIPT_CHARS) || '(none)',
  ].join('\n');

  try {
    const raw = await structuredJsonCall({
      openai,
      model,
      system: SYSTEM,
      user,
      schema: schema as unknown as { name: string; strict?: boolean; schema: Record<string, unknown> },
      stage: 'describe',
    });
    const parsed = JSON.parse(raw || '{}') as { description?: unknown };
    const text = typeof parsed.description === 'string' ? parsed.description.trim() : '';
    if (!text) return null;
    // Redacted like every other authored string that can reach an end-user.
    return redactText(text.slice(0, MAX_DESCRIPTION_CHARS));
  } catch {
    return null;
  }
}

/**
 * Say what the RECORDING covers — the recording-level sibling of the workflow description
 * (docs/build/application-intelligence.md, slice 1: a workflow says what it IS; a recording says
 * what it COVERS).
 *
 * Its one job the workflow list cannot do: name the narration content that ISN'T a workflow — "also
 * explains the pricing plans" — which is exactly the material the Application Intelligence Layer
 * later extracts into pages. Founder-facing (Studio recordings surfaces); never served to end-users.
 *
 * Same posture as `describeWorkflow`: written AFTER distillation so it names the final workflows,
 * best-effort (a recording without a description is the status quo), and it must never invent — an
 * empty answer is the model saying the titles already tell the whole story.
 */
const RECORDING_SYSTEM = `You name a product recording and write ONE short paragraph saying what it COVERS, for the founder who recorded it.

You get the list of workflows that were extracted from the recording, and the full narration transcript.

TITLE — a name for the recording, so the founder can pick it out of a list:
- Three to seven words, sentence case, no trailing period. Name what was demonstrated ("Onboarding a new client", "Billing setup and invoice export"), in the founder's own terms.
- Never a URL, never a product's domain, never a sentence. If the recording covers several unrelated tasks, name the theme or the first two joined with "and".
- Never copy a specific value from the recording — a project name, a person's name, a filename. Name the KIND of thing.

DESCRIPTION — what the recording covers:
- The tasks it demonstrates — group them naturally, never enumerate every step.
- Any product explanation the narration carries BEYOND the tasks: what the product is, features, plans or pricing, concepts explained. Name this — it is the one thing the workflow list cannot show.

Hard rules:
- Use ONLY the workflow titles and the narration. NEVER add products, features, plans, or behaviour from general knowledge — if the narration doesn't say it, it does not exist.
- Never instruct ("click", "go to", "you should") — you are describing coverage, not how to do anything.
- If the narration adds nothing beyond the workflow titles, return an empty description. The founder already sees the workflow list; restating it is noise. Still return a title.
- One to three sentences, plain prose, no lists, no markdown.`;

const recordingSchema = {
  name: 'recording_description',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { title: { type: 'string' }, description: { type: 'string' } },
    required: ['title', 'description'],
  },
} as const;

/** The recording-level read: a NAME for the list and a coverage line. Either may be null — the
 *  description by design when the narration adds nothing, the title only when the call failed. */
export interface RecordingSummary {
  title: string | null;
  description: string | null;
}

const NO_SUMMARY: RecordingSummary = { title: null, description: null };

export async function describeRecording(
  openai: OpenAI,
  model: string,
  workflowTitles: string[],
  transcriptText: string,
): Promise<RecordingSummary> {
  const text = transcriptText.trim();
  // No narration → the workflow titles are the whole story, and Studio already lists them; the
  // recording keeps its URL for a name.
  if (!text) return NO_SUMMARY;

  const user = [
    'WORKFLOWS EXTRACTED FROM THIS RECORDING:',
    workflowTitles.length > 0
      ? workflowTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
      : '(none)',
    '',
    'NARRATION TRANSCRIPT:',
    text.slice(0, MAX_RECORDING_TRANSCRIPT_CHARS),
  ].join('\n');

  try {
    const raw = await structuredJsonCall({
      openai,
      model,
      system: RECORDING_SYSTEM,
      user,
      schema: recordingSchema as unknown as {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      },
      stage: 'describe-recording',
    });
    const parsed = JSON.parse(raw || '{}') as { title?: unknown; description?: unknown };
    const title = typeof parsed.title === 'string' ? cleanTitle(parsed.title) : '';
    const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
    // Redacted like every other authored string a human reads.
    return {
      title: title ? redactText(title.slice(0, MAX_RECORDING_TITLE_CHARS)) : null,
      description: description ? redactText(description.slice(0, MAX_RECORDING_DESCRIPTION_CHARS)) : null,
    };
  } catch {
    return NO_SUMMARY;
  }
}

/** One line, no wrapping quotes, no trailing period — the prompt asks for all three, the model
 *  occasionally forgets one. */
function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().replace(/^["'“”]+|["'“”]+$/g, '').replace(/[.。]+$/, '').trim();
}
