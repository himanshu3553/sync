/**
 * Map a capture-viewport-pixel bbox to CSS percentage geometry over a screenshot. Pure and
 * server-safe — extracted from `components/dashboard/screenshot-highlight.tsx` when the public
 * portal became its second consumer (the portal renders highlights server-side; the Studio
 * components stay client-side and re-export from here).
 *
 * The screenshot is the full viewport (scaled by device pixel ratio), so percentages relative to
 * the viewport line up with the image at any rendered size — no DPR math needed. The one alignment
 * rule: the positioned ancestor must be sized to the IMAGE (natural ratio, or a stage whose
 * aspect-ratio IS the capture viewport's) — percentages of a letterboxed stage drift off the
 * picture. Width/height are clamped so the box never spills past an edge; null for an empty box.
 */

export type Bbox = { x: number; y: number; w: number; h: number };
export type Viewport = { w: number; h: number };

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export function boxStyle(bbox: Bbox, vp: Viewport): React.CSSProperties | null {
  const x = clamp01(bbox.x / vp.w);
  const y = clamp01(bbox.y / vp.h);
  const w = Math.min(clamp01(bbox.w / vp.w), 1 - x);
  const h = Math.min(clamp01(bbox.h / vp.h), 1 - y);
  if (w <= 0 || h <= 0) return null;
  return { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` };
}
