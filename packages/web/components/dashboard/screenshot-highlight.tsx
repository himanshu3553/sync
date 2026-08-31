'use client';

/**
 * The "click here" highlight shared by every surface that draws a captured element's rect onto a
 * screenshot (the step card + lightbox, the frame picker). Extracted at the second consumer.
 */

// The math lives in lib/bbox-style.ts (server-safe pure module) since the portal renders the same
// highlight server-side; this file remains the client-side home of the visual.
export { boxStyle, type Bbox, type Viewport } from '@/lib/bbox-style';

/** Red "click here" highlight — a soft-glow rounded rectangle over the captured target element. */
export function Highlight({ style }: { style: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute rounded-[4px] border-2 border-[#dc2626] bg-[#dc2626]/5 shadow-[0_0_0_2px_rgba(220,38,38,0.20),0_2px_12px_rgba(220,38,38,0.40)]"
      style={style}
    />
  );
}
