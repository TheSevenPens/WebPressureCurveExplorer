---
name: project_terminology
description: Agreed names for UI elements in WebPressureExplorer that lack explicit names in code
type: project
---

**Live pressure indicator** — the dot that moves along the pressure curve in PressureChart showing the current pen pressure in real time. Fed by the `livePressure` prop/state variable. Has no dedicated named constant in code; drawn inline at the end of `drawCurveCanvas()`.

**Why:** User wants a consistent term to use when discussing future enhancements to this element.
**How to apply:** Always refer to this dot as the "live pressure indicator" in conversation and documentation.
