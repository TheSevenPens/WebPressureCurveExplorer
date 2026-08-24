# Architecture

## Component hierarchy

```
App.svelte (root - state owner)
  PressureChart.svelte               (left panel: curve visualization + interaction)
    PressureChartFormat.svelte       (display toggles, in a popover)
    PressureCurveControls.svelte     (DetailsPanel: curve type selector + parameter sliders)
      PressureSmoothingControls.svelte (smoothing type + EMA amount)
        NamedSlider.svelte
      SmoothingOrderControls.svelte  (smoothing order radios)
      NamedSlider.svelte             (multiple instances for curve params)
  ViewPanel.svelte                   (right panel: two toolbars + the active view)
    PenDataToolbar.svelte            (toolbar 1: live pen readouts, shared by both views)
    CanvasControls.svelte            (toolbar 2, canvas mode: clear, colour, brush)
    ResponseControls.svelte          (toolbar 2, response mode: data loader, curve effect)
    DrawingCanvas.svelte             (canvas view: the split drawing surface)
    PressureResponseView.svelte      (response view: pen capture + full-pane chart)
      PressureResponseChart.svelte   (pen hardware response data chart)
```

## Layout regions

The two panels sit in a CSS grid (`#layout`, `grid-template-columns: auto minmax(0, 1fr)`) declared in `app.css`. Named regions, useful when discussing layout changes:

| Region | Selector | Notes |
|---|---|---|
| Driver warning banner | `.driver-warning` | Full-width, dismissable, conditionally rendered |
| Curve panel | `#curve-panel` | Left column, `width: max-content`, holds the two sub-columns below |
| Panel rail | `.panel-rail` | Collapse control on the seam between the columns; its own grid column so it survives the collapse |
| Chart column | `#panel-left` | Panel title, view mode switch, curve canvas, chart action buttons (Copy, Save, Chart Format) |
| Details panel | `#details-panel` | Fixed 247px, the only independently scrolling region |
| View panel | `#view-panel` | Right column: both toolbars plus the active view |
| Pen data toolbar | `.pen-data-toolbar` | Toolbar 1: live pen readouts, identical in both views |
| View controls toolbar | `.view-controls-toolbar` | Toolbar 2: controls for the active view only |
| View body | `.view-body` | One per view; the inactive one carries `.hidden` |
| Draw panel | `#draw-panel` | Canvas view body: the split canvas |
| Split canvas | `.split-canvas-wrap` | Holds both `.draw-canvas` elements, each `flex: 1 1 0` so they share height evenly |

The grid has three columns: the curve panel, the rail, and the view panel. When the left panel is collapsed, `#layout` gains a `left-collapsed` class that hides `#curve-panel` and drops the grid to the rail plus `minmax(0, 1fr)`. `PressureChart` stays mounted so its section states survive the toggle.

The collapse control lives on the seam rather than inside either pane, because a button inside the curve panel would disappear with it and could not bring it back. It is icon-only — a chevron with `aria-label` and `title` of "Hide panel" / "Show panel" — and 24px wide so the target meets WCAG 2.5.8, which matters for a pen-driven app.

## Component roles

### App.svelte
Single source of truth. Owns the `params` object, `livePressure`, `liveRawPressure`, and the `leftPanelsCollapsed` layout flag. Passes `params` down to both panels; receives live pressure values back from DrawingCanvas via bindings. Disables browser context menu globally.

### PressureChart.svelte
Largest component (~1040 lines). Renders the pressure curve chart on a Canvas 2D element. Handles:
- Hosting the Canvas / Pressure Response mode switch at the head of the column
- Drawing the curve path for all curve types (passthrough, flat, basic/extended/sigmoid, bezier)
- Draggable min/max control nodes for extended/sigmoid curves (basic pins its ranges, so it has no nodes)
- Full bezier point editing (drag anchors and handles, add/remove points via buttons or context menu)
- Live pressure indicators (raw = purple, effective = green) with dashed crosshair guides. Both always lie on the curve — see [Live pressure indicators](#live-pressure-indicators)
- Chart export (copy PNG to clipboard, save JPEG)
- Hosting format toggles, curve controls, and the response chart

Its canvas is sized in JS from `#panel-left`'s `clientWidth`, backed at `devicePixelRatio` resolution. The resize returns early when the panel has no layout box, so collapsing does not re-fit the chart down to its 160px floor.

### PressureChartFormat.svelte
Six checkboxes controlling chart display: grid, labels, nodes, node guides, raw indicator, effective indicator. Node-related toggles are disabled when no editable curve is active.

Presented in a popover (`.dropdown-panel`) opened by the Chart Format button beside Copy and Save, rather than a collapsible card. It is a popover and not a menu: it holds checkboxes rather than commands, so it carries no menu role, and it stops click propagation so toggling several options in a row does not dismiss it. The Copy and Save dropdowns remain menus, where dismiss-on-click is what you want.

### PressureCurveControls.svelte
The **DetailsPanel** — all sections are collapsible via CollapsibleSection. Contains:
- **Curve (on/off)** (expanded by default): curve type dropdown with reset button, conditional controls per type:
  - **passthrough**: no controls
  - **flat**: height slider
  - **basic**: Curve Amount slider only (selecting it resets input/output ranges to 0–1 and min approach to clamp)
  - **extended/sigmoid**: Curve Amount slider, read-only node values table (driven by chart nodes), min approach radio buttons
  - **bezier**: preset dropdown, add/remove point buttons
- **Smoothing (on/off)**: smoothing type dropdown with reset button, mirroring the Curve card:
  - **passthrough**: no controls, no reset — smoothing is skipped regardless of the stored amount
  - **EMA**: Smoothing Amount slider
- **Processing Order**: smooth-then-curve vs curve-then-smooth radio buttons (default: smooth-then-curve)
- **Presets**: save (via modal dialog)/load/delete user presets via localStorage

The Curve and Smoothing titles report whether that stage actually changes the pressure. Curve uses `isIdentityCurve` from curveMath, which samples the configured transform rather than reading `curveType`, so a neutral basic/extended/sigmoid curve (CurveAmount 0, full ranges) reads "off" just as passthrough does. Smoothing reads "off" when the type is passthrough, or when `emaSmoothing` is 0, where the EMA alpha is 1 and output equals input.

### PressureSmoothingControls.svelte
Smoothing type dropdown (passthrough or EMA) plus, for EMA, the Smoothing Amount slider and a reset button. Follows the same shape as the Curve card's type selector, and hides the reset for passthrough exactly as that card does.

Selecting passthrough leaves `emaSmoothing` untouched, so switching back to EMA restores the previous amount.

### SmoothingOrderControls.svelte
Radio pair selecting where smoothing sits relative to the curve: smooth-then-curve or curve-then-smooth. Its own DetailsPanel card ("Processing Order"), separate from the smoothing amount.

### ViewPanel.svelte
The right column. Owns the two toolbars and swaps the view beneath them.

- **Pen data toolbar** — live pen readouts, identical in both views, so it lives here rather than inside either one.
- **View controls toolbar** — whichever control set the active view needs.

Both view bodies stay mounted and the inactive one is hidden with `display: none`, so switching modes does not discard the drawing or the loaded response data. App clears the live pressure values on a switch and ViewPanel clears the readouts, since the outgoing view owned them and its last pointer event would otherwise freeze the indicators.

The mode switch itself lives at the head of the chart column, not here — it is navigation for the whole app rather than a control belonging to either view. The consequence is that switching is unavailable while the left column is collapsed; the seam rail brings it back in one click.

Brush size, colour mode and pressure-control mode live here because the controls sit in the toolbar while the strokes are drawn one level down in DrawingCanvas.

### PenDataToolbar.svelte
Toolbar 1. Pointer type, the pressure flow (raw -> intermediate -> output, the middle value depending on smoothing order), tilt, azimuth and altitude. Every value has a reserved width so changing pointer type or values never shifts the row.

### CanvasControls.svelte
Toolbar 2 in canvas mode: clear, stroke colour mode, whether pressure drives size or opacity, and brush size.

### ResponseControls.svelte
Toolbar 2 in response mode: the data dropdown with three bundled Wacom KP-504E samples (WAP.0038, WAP.0047, WAP.0050) and an "Upload JSON..." option, a clear button, the "show effect of curve" checkbox, and a summary of the loaded dataset.

### PressureResponseView.svelte
The response view body. Renders PressureResponseChart at full pane size, and captures pen pressure without drawing anything, so the live indicators on both charts keep tracking while you press the pen against the tablet.

### CollapsibleSection.svelte
Reusable section wrapper with clickable header that toggles content visibility. Used throughout DetailsPanel and the curve panel.

### PressureResponseChart.svelte
Standalone canvas chart rendering a pen's physical pressure response (grams-force vs logical %). When "show effect of curve" is enabled, applies the current pressure curve to the Y values, and the Y axis label switches from `LOGICAL %` to `OUTPUT %`. Draws live indicators on the response curve matching the main chart's indicators.

With `fill` set it sizes to its container in both dimensions instead of a fixed 0.6 aspect ratio, which is how the response view gives it the whole pane.

### NamedSlider.svelte
Reusable labeled slider component. Features: click-to-edit value display, right-click context menu (min/max/reset), optional non-linear (power-law curved) slider response, configurable display formatting.

### DrawingCanvas.svelte
The canvas view body. Split drawing surface with two canvases. The top canvas ("Pressure processing: ON") renders strokes using the full pressure pipeline (smoothing + curve application). The bottom canvas ("Pressure processing: OFF") renders the same strokes using raw unprocessed pen pressure. Drawing in either half mirrors to the other, allowing direct visual comparison. Clear via Delete/Backspace, or the toolbar button, which calls the exported `clear()`.

Takes its brush controls as props from ViewPanel and writes the pen readouts back up through a bound `info`.

Both canvases are backed at real screen-pixel resolution (see [Canvas resolution](#canvas-resolution) below). Resizing is skipped while the panel has no layout box, so the strokes survive both a mode switch and a panel collapse.

## Shared utilities

| Module | Purpose |
|---|---|
| `curveMath.js` | Pure math: curve evaluation, bezier normalization, Hermite interpolation |
| `curveTypes.js` | `CURVE_TYPE` enum for all curve type identifiers |
| `uiConstants.js` | `VIEW_MODE`, `SMOOTHING_ORDER`, `SMOOTHING_TYPE`, `MIN_APPROACH`, `HANDLE_MODE`, `COLOR_MODE`, `PRESSURE_CONTROL` enums |
| `bezierPresets.js` | Built-in bezier curve preset point definitions |
| `canvasConstants.js` | Shared padding/spacing values for canvas charts |
| `canvasUtils.js` | Shared canvas drawing: background, grid, axis labels, indicator dots |
| `emaConstants.js` | EMA smoothing constants (max, midpoint target, curve exponent) |
| `fileNames.js` | `timestampedFileName(base, ext)` for export downloads |
| `pressurePipeline.js` | EMA state, `process()`, and the pen info builder, shared by every view that accepts pen input |

### curveMath.js

`applyPressureCurve(x, params) -> number` is the main entry point, used by both the chart and the drawing canvas:

1. Return early for passthrough (`x`), flat (`flatLevel`) and bezier (evaluate the custom curve)
2. Apply the min approach (`cut` returns 0 below `inputMinimum`)
3. Normalize the input using `[inputMinimum, inputMaximum]`
4. Apply the curve algorithm and scale to `[minimum, maximum]`
5. Apply boundary transition smoothing (cubic Hermite) if `transitionWidth > 0`

| `curveType` | Algorithm |
|---|---|
| `passthrough` | Pass-through (`x` unchanged) |
| `flat` | Return `flatLevel` constant |
| `basic` / `extended` | Power law: exponent derived from `softness` |
| `sigmoid` | Logistic function: `k = softness * 14` |
| `bezier` | Cubic Bezier evaluation via binary search |

`basic` and `extended` share the same math; they differ only in the controls exposed. Selecting `basic` pins the input/output ranges to 0–1.

Other exports and internal helpers:

- `isIdentityCurve(params)` — samples the transform at 33 points and reports whether every input maps to itself; drives the Curve card's on/off title
- `invertPressureCurve(y, params, fallbackX)` — bisection for the input that maps to `y`; used to place the effective indicator under curve-then-smooth
- `rawCurveOutput(xNorm, params)` — power/sigmoid calculation, scaled to the output range
- `rawCurveSlope(xNorm, params)` — numerical derivative (for Hermite transitions)
- `cubicHermite(t, y0, m0, y1, m1)` — cubic Hermite interpolation
- `normalizeBezierPoints(points)` — validate/sort/clamp bezier control points
- `buildCustomSegments(points)` — convert points to bezier segment definitions
- `cubicAt(t, p0, c0, c1, p1)` — evaluate cubic Bezier at parameter `t`
- `solveBezierTForX(x, segment)` — binary search for `t` given `x` (28 iterations)
- `evaluateCustomCurve(x, points)` — full bezier curve evaluation

## State management

All application state flows through a single `params` object owned by App.svelte:

```
App.svelte (params, live*, leftPanelsCollapsed, viewMode,
            pressureResponseData, showResponseCurveEffect)
  |
  |-- bind:params --> PressureChart --> PressureCurveControls (sliders modify params)
  |
  |-- viewMode + onViewModeChange --> PressureChart (hosts the view switch)
  |
  |-- viewMode (read) --> ViewPanel
  |     |-- DrawingCanvas          (canvas view)
  |     |-- PressureResponseView   (response view)
  |     |
  |     |-- bind:live* --> App     (whichever view is active writes them)
  |     |-- onResponseDataChange --> App
  |
  |-- .panel-rail (in App) toggles leftPanelsCollapsed
```

Components update params via `patchParams({ key: value })` which spreads into a new object, triggering Svelte reactivity. The chart re-renders whenever params, live pressure values, or display toggles change.

## Data flow

The component wiring is above; this is what happens to a pointer event. Only the
active view produces these, since the hidden one receives no events.

```
pointer event on the active view
  (DrawingCanvas or PressureResponseView)
        |
        v
  processor.process(rawPressure, params)      [pressurePipeline.js]
        |
        +--> info ................> PenDataToolbar        (readouts)
        |
        +--> liveRawPressure .....> App --> PressureChart (purple indicator)
        |                               --> PressureResponseChart
        |
        +--> livePressure ........> App --> PressureChart (effective indicator X,
        |                                                  under smooth-then-curve)
        |
        +--> liveOutputPressure ..> App --> PressureChart (effective indicator Y)
        |                               --> PressureResponseChart
        |
        +--> outputPressure ......> brush size or opacity (canvas view only)
```

## Data model

The `params` object:

| Field | Type | Range | Purpose |
|---|---|---|---|
| `curveType` | string | `'passthrough'`, `'flat'`, `'basic'`, `'extended'`, `'sigmoid'`, `'bezier'` | Active curve algorithm (see `CURVE_TYPE` in curveTypes.js) |
| `softness` | number | -0.9 to 0.9 | Curve shape (power exponent / sigmoid steepness) |
| `inputMinimum` | number | 0-1 | Start of input pressure range |
| `inputMaximum` | number | 0-1 | End of input pressure range |
| `minimum` | number | 0-1 | Start of output pressure range |
| `maximum` | number | 0-1 | End of output pressure range |
| `minApproach` | string | `'clamp'`, `'cut'` | Behavior below input minimum |
| `flatLevel` | number | 0-1 | Constant output for flat curve |
| `transitionWidth` | number | 0-0.5 | Hermite transition smoothing width (no UI control) |
| `bezierPoints` | array | 2-16 points | Bezier control points |
| `smoothingType` | string | `'passthrough'`, `'ema'` | Smoothing algorithm (default: ema) |
| `emaSmoothing` | number | 0-0.99 | Pressure EMA smoothing amount (EMA type only) |
| `smoothingOrder` | string | `'smooth-then-curve'`, `'curve-then-smooth'` | Pipeline order (default: smooth-then-curve) |

Each bezier point is `{ x, y, inX, inY, outX, outY, handleMode }`, where `handleMode` is `'broken'` or `'mirrored'` and points are sorted by `x`.

User presets store a deep copy of this object in localStorage. Loading replaces `params` wholesale, so presets saved under an older schema still load — unknown keys simply go unread.

## Live pressure indicators

Two dots track live pen input on the curve chart:

- **Raw pressure indicator** — purple, at `(rawPressure, curve(rawPressure))`.
- **Effective pressure indicator** — green. Its Y is always `outputPressure`, the value that actually drives the brush. Its X depends on the smoothing order, so that the dot lies on the curve either way:
  - **smooth-then-curve** — X is `preCurvePressure`, the smoothed input the pipeline really fed to the curve, so the point is on the curve by construction. The gap to the raw dot is the smoothing lag on the input.
  - **curve-then-smooth** — smoothing runs after the curve, so the output corresponds to no input the pipeline ever evaluated. X comes from `invertPressureCurve`: the input that *would* produce this output. That X is derived rather than measured, and a steep curve can place it far from the raw dot.

A non-invertible curve — flat, or any curve whose endpoints share an output — falls back to the pressure being applied, which keeps the dot on the flat line rather than inventing a position.

Both charts draw the effective indicator from `outputPressure`; the response chart plots by Y alone, so the inversion does not apply there.

## Canvas resolution

Every canvas in the app is backed at real screen-pixel resolution and drawn in CSS pixels via a context transform, so strokes and chart lines rasterize at full display resolution rather than being upscaled by the compositor.

- The charts size their backing store as `round(cssSize * devicePixelRatio)`.
- The drawing canvases take the exact integer device-pixel box from `ResizeObserver`'s `device-pixel-content-box`, falling back to `round(rect * dpr)`. Observing that box also picks up dpr changes from browser zoom and from moving the window between monitors with different scale factors.
- Resizing a drawing canvas preserves its contents: the backing store is snapshotted, restored at 1:1 and anchored top-left. Without this, collapsing the left panels (or resizing the window) would wipe the drawing.

## Pressure processing pipeline

```
Raw pen pressure (event.pressure, 0-1)
  |
  v
[EMA smoothing]  <-- if smoothingOrder = "smooth-then-curve"
  |
  v
[applyPressureCurve]
  |
  v
[EMA smoothing]  <-- if smoothingOrder = "curve-then-smooth"
  |
  v
Output pressure (0-1) --> brush size or opacity
```

Pointer coordinates are used as delivered by the event; there is no position smoothing.

## Pressure response data schema

JSON files in `sample-pressure-response/`, and any file accepted via upload, follow this schema:

```js
{
  "brand":       string,   // Manufacturer (e.g. "WACOM")
  "pen":         string,   // Pen model number (e.g. "KP-504E")
  "penfamily":   string,   // Product family (optional)
  "inventoryid": string,   // Internal tracking ID (e.g. "WAP.0038")
  "date":        string,   // Measurement date (YYYY-MM-DD)
  "user":        string,   // Who performed the measurement
  "tablet":      string,   // Tablet model (e.g. "PTH-870")
  "driver":      string,   // Driver used
  "os":          string,   // Operating system
  "notes":       string,   // Free-form notes
  "records": [
    [gramForce, logicalPressurePercent],  // e.g. [82.0, 51.4079]
    ...
  ]
}
```

Each record is one empirical measurement: the physical force applied in **gram-force (gf)** and the logical pressure value the pen reported to the OS as a **percentage (0-100)**. Records are sorted by ascending gram-force.

## Key design points

1. **No runtime dependencies** — Svelte 5 + Vite 6 only. All rendering uses Canvas 2D API directly.
2. **Single state owner** — App.svelte owns params; child components either bind or receive read-only props.
3. **Pure math separation** — curveMath.js has no Svelte dependencies. It can be imported by any component or tested independently.
4. **Canvas-first rendering** — Both the curve chart and drawing surface use HTML Canvas for performance. No SVG or DOM-based charting.
5. **Shared canvas utilities** — Grid, background, labels, and indicator rendering are extracted to canvasUtils.js to avoid duplication between PressureChart and PressureResponseChart.

## File index

| File | Type | Purpose |
|---|---|---|
| [src/App.svelte](../src/App.svelte) | Component | Root, state owner |
| [src/main.js](../src/main.js) | Entry point | Mounts App to DOM |
| [src/app.css](../src/app.css) | Styles | Global styles and layout grid |
| [src/lib/PressureChart.svelte](../src/lib/PressureChart.svelte) | Component | Curve chart & host for controls |
| [src/lib/PressureChartFormat.svelte](../src/lib/PressureChartFormat.svelte) | Component | Chart display toggles |
| [src/lib/PressureCurveControls.svelte](../src/lib/PressureCurveControls.svelte) | Component | Curve type + sliders + presets |
| [src/lib/PressureResponseChart.svelte](../src/lib/PressureResponseChart.svelte) | Component | Hardware response data chart |
| [src/lib/ViewPanel.svelte](../src/lib/ViewPanel.svelte) | Component | Right column: toolbars + view switching |
| [src/lib/PenDataToolbar.svelte](../src/lib/PenDataToolbar.svelte) | Component | Toolbar 1: live pen readouts |
| [src/lib/CanvasControls.svelte](../src/lib/CanvasControls.svelte) | Component | Toolbar 2: canvas-mode controls |
| [src/lib/ResponseControls.svelte](../src/lib/ResponseControls.svelte) | Component | Toolbar 2: response-mode controls |
| [src/lib/PressureResponseView.svelte](../src/lib/PressureResponseView.svelte) | Component | Response view body |
| [src/lib/PressureSmoothingControls.svelte](../src/lib/PressureSmoothingControls.svelte) | Component | Pressure EMA amount |
| [src/lib/SmoothingOrderControls.svelte](../src/lib/SmoothingOrderControls.svelte) | Component | Smoothing order radios |
| [src/lib/CollapsibleSection.svelte](../src/lib/CollapsibleSection.svelte) | Component | Reusable collapsible section |
| [src/lib/NamedSlider.svelte](../src/lib/NamedSlider.svelte) | Component | Reusable labeled slider |
| [src/lib/DrawingCanvas.svelte](../src/lib/DrawingCanvas.svelte) | Component | Drawing surface + pressure input |
| [src/lib/curveMath.js](../src/lib/curveMath.js) | Utility | Pressure curve math |
| [src/lib/curveTypes.js](../src/lib/curveTypes.js) | Utility | `CURVE_TYPE` enum |
| [src/lib/uiConstants.js](../src/lib/uiConstants.js) | Utility | UI enums |
| [src/lib/bezierPresets.js](../src/lib/bezierPresets.js) | Utility | Bezier preset definitions |
| [src/lib/canvasConstants.js](../src/lib/canvasConstants.js) | Utility | Chart padding/spacing |
| [src/lib/canvasUtils.js](../src/lib/canvasUtils.js) | Utility | Shared canvas drawing |
| [src/lib/emaConstants.js](../src/lib/emaConstants.js) | Utility | EMA smoothing constants |
| [src/lib/fileNames.js](../src/lib/fileNames.js) | Utility | Timestamped export filenames |
| [src/lib/pressurePipeline.js](../src/lib/pressurePipeline.js) | Utility | Shared smoothing state + pen info |
| [sample-pressure-response/](../sample-pressure-response/) | Data | Bundled pen response JSON files |
