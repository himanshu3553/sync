import { describe, expect, it } from 'vitest';
import type { CapturedEvent } from '@flowbuddy/shared';
import {
  compileSop,
  renderAgentSop,
  renderHumanSop,
  sopImageName,
  type SopInput,
  type SopStepSource,
} from './sop';
import { highlightRect } from './sop-image';

/**
 * The SOP compiler + its two renderers.
 *
 * WHY THESE. This is the first artifact FlowBuddy produces for readers OUTSIDE the product — a
 * downloaded guide, and a manual handed verbatim to third-party agents. Its failure directions are
 * trust failures, not display bugs: a raw route leaks a record id from the founder's own account,
 * a recorded input value leaks what the founder typed, and a missing "value comes from your
 * principal" marker teaches an agent to invent values. Each of those rules gets a pinned test, and
 * so does graceful degradation (no events → a text-only document, never a throw): the SOP must
 * render for every workflow the KB page can show, not only the actable subset.
 */

const COMPILED_AT = '2026-08-25T00:00:00.000Z';

let seq = 0;
function ev(partial: Partial<CapturedEvent> & { type: string }): CapturedEvent {
  seq += 1;
  return {
    id: partial.id ?? `e${seq}`,
    t: seq * 1000,
    target: {},
    route: { url: 'https://app.example.com/projects', path: '/projects', hash: '', title: 'Projects' },
    ...partial,
  } as CapturedEvent;
}

function clickEvent(id: string, over: Partial<CapturedEvent> = {}): CapturedEvent {
  return ev({
    id,
    type: 'click',
    target: {
      tag: 'button',
      accessibleName: 'New project',
      locators: [
        { strategy: 'testid', value: '[data-testid="new-project"]', unique: true },
        { strategy: 'css', value: 'button.new' },
      ],
    },
    ...over,
  });
}

function fillEvent(id: string, over: Partial<CapturedEvent> = {}): CapturedEvent {
  return ev({
    id,
    type: 'input',
    target: {
      tag: 'input',
      attributes: { placeholder: 'Project name' },
      locators: [{ strategy: 'placeholder', value: 'Project name', unique: true }],
    },
    ...over,
  });
}

function sopInput(steps: SopStepSource[], events?: CapturedEvent[], extra: Partial<SopInput> = {}): SopInput {
  return { title: 'Create a project', steps, events, compiledAt: COMPILED_AT, ...extra };
}

describe('compileSop', () => {
  it('compiles verbs, input slots and locators from recovered events', () => {
    const events = [clickEvent('c1'), fillEvent('f1')];
    const model = compileSop(
      sopInput(
        [
          { instruction: 'Click "New project"', route: '/projects', keyEventId: 'c1', screenshotFile: 's1.jpg' },
          { instruction: 'Enter the project name', route: '/projects', keyEventId: 'f1' },
        ],
        events,
      ),
    );
    expect(model.steps[0]).toMatchObject({ index: 1, verb: 'click', hasImage: true });
    expect(model.steps[0]!.locators[0]).toMatchObject({ strategy: 'testid' });
    expect(model.steps[1]).toMatchObject({
      verb: 'fill',
      input: { label: 'Project name', sensitive: false },
      hasImage: false,
    });
    expect(model.entryRoute).toBe('/projects');
  });

  it('degrades to a text-only step when the event is unrecoverable — never a throw', () => {
    const model = compileSop(sopInput([{ instruction: 'Do the thing', route: '/projects' }]));
    expect(model.steps[0]).toMatchObject({ instruction: 'Do the thing', locators: [] });
    expect(model.steps[0]!.verb).toBeUndefined();
  });

  it('patterns every exported route — a raw record id from the recording must not leave', () => {
    const model = compileSop(
      sopInput([
        {
          instruction: 'Open the project',
          route: '/projects/9f3c2a1e-0000-4000-8000-c0ffee000001/settings',
        },
      ]),
    );
    expect(model.steps[0]!.route).not.toContain('9f3c2a1e');
    expect(model.steps[0]!.humanRoute).not.toContain('9f3c2a1e');
    expect(model.entryRoute).not.toContain('9f3c2a1e');
  });

  it('marks sensitive inputs and destructive steps from the same rules the acting run uses', () => {
    const events = [
      fillEvent('pw', {
        target: { tag: 'input', attributes: { type: 'password', placeholder: 'Password' } },
      }),
      clickEvent('del', { target: { tag: 'button', accessibleName: 'Delete project' } }),
    ];
    const model = compileSop(
      sopInput(
        [
          { instruction: 'Enter your password', keyEventId: 'pw' },
          { instruction: 'Click Delete project', keyEventId: 'del' },
        ],
        events,
      ),
    );
    expect(model.steps[0]!.input).toMatchObject({ sensitive: true });
    expect(model.steps[1]!.destructive).toBe(true);
  });

  it('carries step evidence into expect and states pattern-changing landings only', () => {
    const events = [
      clickEvent('c1', {
        postAction: { route: { url: 'https://app.example.com/projects/123', path: '/projects/123' } },
      } as Partial<CapturedEvent>),
    ];
    const model = compileSop(
      sopInput(
        [
          {
            instruction: 'Click "New project"',
            route: '/projects',
            keyEventId: 'c1',
            evidence: { appeared: ['Project created'], landedTitle: 'Project — Overview' },
          },
        ],
        events,
      ),
    );
    expect(model.steps[0]!.expect).toMatchObject({ appeared: ['Project created'] });
    expect(model.steps[0]!.navigatesTo).toBe('/projects/:id');
  });
});

describe('renderAgentSop', () => {
  const model = compileSop(
    sopInput(
      [
        { instruction: 'Click "New project"', route: '/projects', keyEventId: 'c1', screenshotFile: 's1.jpg' },
        { instruction: 'Enter the project name', route: '/projects', keyEventId: 'f1' },
      ],
      [clickEvent('c1'), fillEvent('f1')],
      { description: 'Creates a project. The template step is optional.' },
    ),
  );

  it('renders goal, preconditions, the freshness stamp and the principal-values rule', () => {
    const md = renderAgentSop(model);
    expect(md).toContain('## Goal');
    expect(md).toContain('Creates a project.');
    expect(md).toContain('Start at route `/projects`');
    expect(md).toContain(`Compiled: ${COMPILED_AT}`);
    expect(md).toContain('value comes from your principal (field: "Project name")');
  });

  it('ships no images and, by default, no machine layer', () => {
    const md = renderAgentSop(model);
    expect(md).not.toContain('![');
    expect(md).not.toContain('```json');
    const withMachine = renderAgentSop(model, { machineLayer: true });
    expect(withMachine).toContain('```json');
    expect(withMachine).toContain('"strategy":"testid"');
  });

  it('adds the never-relay rule for sensitive inputs', () => {
    const sensitive = compileSop(
      sopInput(
        [{ instruction: 'Enter your password', keyEventId: 'pw' }],
        [fillEvent('pw', { target: { tag: 'input', attributes: { type: 'password', placeholder: 'Password' } } })],
      ),
    );
    expect(renderAgentSop(sensitive)).toContain('never relay it through chat');
  });
});

describe('renderHumanSop', () => {
  it('renders elided routes and references images only for steps that have one', () => {
    const model = compileSop(
      sopInput([
        { instruction: 'Open the project', route: '/projects/9f3c2a1e-0000-4000-8000-c0ffee000001', screenshotFile: 's1.jpg' },
        { instruction: 'Rename it', route: '/projects/9f3c2a1e-0000-4000-8000-c0ffee000001' },
      ]),
    );
    const md = renderHumanSop(model, { imagePath: (s) => `images/${sopImageName(s)}` });
    expect(md).toContain('![Step 1 — Open the project](images/step-01.png)');
    expect(md).not.toContain('step-02.png');
    expect(md).not.toContain('9f3c2a1e');
  });
});

describe('highlightRect', () => {
  const viewport = { w: 1280, h: 800 };

  it('scales a bbox onto the resized, control-bar-cropped output', () => {
    const rect = highlightRect({ x: 640, y: 100, w: 128, h: 36 }, viewport, { w: 640, h: 362 });
    expect(rect).not.toBeNull();
    // x scale = 0.5; pad pushes outward.
    expect(rect!.x).toBeLessThan(320);
    expect(rect!.x + rect!.w).toBeGreaterThan(320 + 64);
  });

  it('returns null for a target inside the cropped control-bar strip or degenerate', () => {
    expect(highlightRect({ x: 10, y: 790, w: 50, h: 8 }, viewport, { w: 1280, h: 724 })).toBeNull();
    expect(highlightRect({ x: 10, y: 10, w: 0, h: 8 }, viewport, { w: 1280, h: 724 })).toBeNull();
  });
});
