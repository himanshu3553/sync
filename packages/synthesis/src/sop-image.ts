import sharp from 'sharp';
import { CONTROLBAR_CROP_CSS_PX } from './video-plan';

/**
 * The SOP step-image renderer — the still-image sibling of video-render.ts: one captured
 * screenshot in, one documentation-ready PNG out (control bar cropped, resized, and the recorded
 * click target ringed). Decisions the video pipeline already made are reused, not re-made:
 * the control-bar crop rides the same CONTROLBAR_CROP_CSS_PX (the bar is baked into every stored
 * frame at its default position), and bbox scaling follows the same image-px / viewport-CSS-px
 * model (`scale = image width / viewport width` — DPR-independent).
 *
 * Tuning constants (this header is their home):
 *   SOP_IMAGE_MAX_W = 1600 — documentation width: crisp on a retina article page at ~800 CSS px,
 *     a fraction of the video renderer's 2720 (which exists only to survive 1.6× camera zoom).
 *   HIGHLIGHT_PAD_PX = 6 — breathing room so the ring frames the control instead of hugging it.
 *   Ring: 3px indigo over a 7px white underlay — reads on both dark and light UI regions.
 *     Hexes mirror docs/design_system/tokens/colors.css, which OWNS them; change there first.
 */

export const SOP_IMAGE_MAX_W = 1600;
const HIGHLIGHT_PAD_PX = 6;
const INDIGO_400 = '#4a63e8';
const WHITE = '#ffffff';

export interface SopStepImageInput {
  screenshot: Buffer;
  /** Recorded viewport in CSS px (from the capture manifest). */
  viewport: { w: number; h: number };
  /** Clicked-element rect in CSS px of the recorded viewport; null/absent → no highlight. */
  bbox?: { x: number; y: number; w: number; h: number } | null;
}

export async function renderSopStepImage(input: SopStepImageInput): Promise<Buffer> {
  const meta = await sharp(input.screenshot).metadata();
  const srcW = meta.width ?? input.viewport.w;
  const srcH = meta.height ?? input.viewport.h;
  const scale = srcW / Math.max(1, input.viewport.w);
  const cropPx = Math.max(0, Math.min(srcH - 1, Math.round(CONTROLBAR_CROP_CSS_PX * scale)));
  const croppedH = srcH - cropPx;

  let img = sharp(input.screenshot).extract({ left: 0, top: 0, width: srcW, height: croppedH });
  let outW = srcW;
  let outH = croppedH;
  if (outW > SOP_IMAGE_MAX_W) {
    outH = Math.round(croppedH * (SOP_IMAGE_MAX_W / outW));
    outW = SOP_IMAGE_MAX_W;
    img = sharp(await img.toBuffer()).resize({ width: outW, height: outH, fit: 'fill' });
  }

  const rect = input.bbox ? highlightRect(input.bbox, input.viewport, { w: outW, h: outH }) : null;
  if (rect) {
    const ring = Buffer.from(
      `<svg width="${outW}" height="${outH}">
        <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="8"
          fill="none" stroke="${WHITE}" stroke-opacity="0.9" stroke-width="7"/>
        <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="8"
          fill="none" stroke="${INDIGO_400}" stroke-width="3"/>
      </svg>`,
    );
    img = sharp(await img.toBuffer()).composite([{ input: ring, blend: 'over' }]);
  }

  return img.png().toBuffer();
}

/** Map a CSS-px bbox onto the cropped, resized output image, padded and clamped. Returns null when
 *  the bbox is degenerate or lies entirely inside the cropped control-bar strip — the same "nothing
 *  to point at" rule as the video plan's normalizeTarget. Exported for tests (pure). */
export function highlightRect(
  bbox: { x: number; y: number; w: number; h: number },
  viewport: { w: number; h: number },
  out: { w: number; h: number },
): { x: number; y: number; w: number; h: number } | null {
  const effH = viewport.h - CONTROLBAR_CROP_CSS_PX;
  if (effH <= 0 || viewport.w <= 0 || bbox.w <= 0 || bbox.h <= 0) return null;
  if (bbox.y >= effH) return null;
  const sx = out.w / viewport.w;
  const sy = out.h / effH;
  const pad = HIGHLIGHT_PAD_PX;
  const x = Math.max(2, bbox.x * sx - pad);
  const y = Math.max(2, bbox.y * sy - pad);
  const w = Math.min(out.w - 2 - x, bbox.w * sx + pad * 2);
  const h = Math.min(out.h - 2 - y, Math.min(bbox.h, effH - bbox.y) * sy + pad * 2);
  if (w <= 0 || h <= 0) return null;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}
