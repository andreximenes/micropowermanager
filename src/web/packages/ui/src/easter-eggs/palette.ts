// Eggs draw on <canvas> and in inline styles, where CSS custom properties are
// awkward to read — so the brand palette is duplicated here as literals. These
// must stay in sync with @spark/design-tokens (--green-bright, --teal, --navy).
export const EGG_GREEN = '#51e632';
export const EGG_GREEN_LINE = '#5be641';
export const EGG_TEAL = '#77c7cd';
export const EGG_NAVY = '#130151';

// Every overlay sits above everything and never intercepts a click.
export const OVERLAY_CSS =
  'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
