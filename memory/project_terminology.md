---
name: project_terminology
description: Agreed names for UI elements in WebPressureExplorer that lack explicit names in code
type: project
---

There are two live pressure indicators drawn inline at the end of `drawCurveCanvas()` in PressureChart:

**Raw pressure indicator** — purple (`#8833cc`), filled circle. Tracks `liveRawPressure` = raw `event.pressure` with no processing. Shows where the unmodified pen input sits on the curve.

**Effective pressure indicator** — green (`#14a050`), filled circle. Tracks `livePressure` = `preCurvePressure` (smoothed+curved output). Shows what actually drives the brush.

**Why:** User wants consistent terms for discussing future enhancements to these elements.
**How to apply:** Use "raw pressure indicator" and "effective pressure indicator" in conversation and documentation. The collective term is "live pressure indicators".
