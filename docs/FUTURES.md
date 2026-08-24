# Futures

Ideas, known issues, and potential directions for WebPressureExplorer.

## Known issues

- **Context menu positioning** — The bezier right-click context menu uses `clientX`/`clientY` and can overflow off-screen on small viewports.
- **No dark mode** — Colors are hardcoded for a light theme.

## Feature suggestions

- **Max approach mode** — Analogous to the min approach (clamp/cut), add configurable behavior for the segment above the max control node. Currently it always clamps to the maximum output value.
- **Undo/redo** — Track param changes and allow stepping back through history, especially useful during bezier editing.
- **Bezier import/export** — Copy/paste bezier point data as JSON for sharing or backup.
- **Pressure response overlay** — Show the response data curve overlaid directly on the main pressure curve chart, not just in a separate sub-chart.
- **Multiple response datasets** — Load and compare several pens' response data side by side.
- **Touch/mobile support** — Test and improve the UI for touch-only devices and smaller screens.
- **Keyboard shortcuts** — Add shortcuts for common actions (reset, toggle grid, collapse panels, undo).
- **URL state persistence** — Encode params in the URL hash so configurations can be shared via link.
- **LocalStorage persistence of the working state** — Named presets already persist; remember the last-used params across browser sessions too.
- **Remember the collapsed layout** — The collapse toggle resets to expanded on reload; persisting it would suit users who work mostly in the canvas.

## Potential directions

- **Application-specific profiles** — Model pressure curves as used by specific drawing applications (Photoshop, Clip Studio Paint, Krita) to help users understand how their app's built-in curve interacts with tablet driver curves.
- **Curve comparison mode** — Show two curves overlaid to compare different settings visually.
- **Pressure recording and playback** — Record a stroke's pressure data over time and replay it through different curve settings to compare feel without re-drawing.
- **Expanded hardware data** — Build a larger library of bundled pen response datasets covering more brands and models.
- **API / embeddable widget** — Package the curve editor as a standalone component that other web apps could embed.

## Technical improvements

- **Widen test coverage** — `curveMath.js` is covered by vitest and CI runs it. `bezierInteraction.js` and `userPresets.js` are now pure modules and are the obvious next targets.
- **Responsive layout** — The two-panel grid doesn't adapt to narrow viewports. The collapse toggle helps reclaim canvas space on demand, but a stacked layout for small screens is still missing.
- **Canvas resize behavior** — Drawing canvases preserve their contents across a resize by snapshotting and redrawing anchored top-left. Content that falls outside a shrunken canvas is lost on the next resize; keeping an off-screen buffer at maximum extent would avoid that.

## Removed features

- **Position smoothing** — An EMA over pointer coordinates, configured by its own Position Smoothing panel. Removed deliberately; pointer coordinates now go straight from the event to the stroke. Presets saved while it existed still load, with the stale `positionEmaSmoothing` key simply going unread.
