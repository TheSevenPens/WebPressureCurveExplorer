/**
 * Colors for the two live pressure indicators. The names match
 * memory/project_terminology.md: the raw indicator tracks unprocessed
 * event.pressure, the effective one tracks the pressure driving the brush.
 *
 * `guide` is the dashed crosshair drawn to the axes. Both charts used slightly
 * different alphas for it before these were centralized; the curve chart's
 * values win, since that is the chart the indicators were designed on.
 */
export const RAW_INDICATOR = Object.freeze({
  solid: '#8833cc',
  guide: 'rgba(130, 60, 200, 0.2)',
});

export const EFFECTIVE_INDICATOR = Object.freeze({
  solid: '#14a050',
  guide: 'rgba(20, 160, 80, 0.2)',
});
