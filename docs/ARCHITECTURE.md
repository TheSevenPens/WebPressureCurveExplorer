# Architecture

## Component hierarchy

```
App.svelte (root - state owner)
  PressureChart.svelte               (left panel: curve visualization + interaction)
    PressureChartFormat.svelte       (display toggles: grid, labels, nodes, indicators)
    PressureResponseChart.svelte     (pen hardware response data chart)
    PressureCurveControls.svelte     (DetailsPanel: curve type selector + parameter sliders)
      PressureSmoothingControls.svelte (pressure EMA amount)
        NamedSlider.svelte
      SmoothingOrderControls.svelte  (smoothing order radios)
      NamedSlider.svelte             (multiple instances for curve params)
      PressureResponsePanel.svelte   (load/select pen response data)
  DrawingCanvas.svelte               (right panel: drawing area)
    DrawingCanvasHeader.svelte       (toolbar: live info + collapse/clear buttons)
```

## Layout regions

The two panels sit in a CSS grid (`#layout`, `grid-template-columns: auto minmax(0, 1fr)`) declared in `app.css`. Named regions, useful when discussing layout changes:

| Region | Selector | Notes |
|---|---|---|
| Driver warning banner | `.driver-warning` | Full-width, dismissable, conditionally rendered |
| Curve panel | `#curve-panel` | Left column, `width: max-content`, holds the two sub-columns below |
| Chart column | `#panel-left` | Panel title, curve canvas, chart export actions, Chart Format and Pressure Response sections |
| Details panel | `#details-panel` | Fixed 247px, the only independently scrolling region |
| Draw panel | `#draw-panel` | Right column: toolbar plus the split canvas |
| Split canvas | `.split-canvas-wrap` | Holds both `.draw-canvas` elements, each `flex: 1 1 0` so they share height evenly |

When the left panels are collapsed, `#layout` gains a `left-collapsed` class that hides `#curve-panel` and switches the grid to a single `minmax(0, 1fr)` column. `PressureChart` stays mounted so its loaded data and section states survive the toggle.

## Component roles

### App.svelte
Single source of truth. Owns the `params` object, `livePressure`, `liveRawPressure`, and the `leftPanelsCollapsed` layout flag. Passes `params` down to both panels; receives live pressure values back from DrawingCanvas via bindings. Disables browser context menu globally.

### PressureChart.svelte
Largest component (~1040 lines). Renders the pressure curve chart on a Canvas 2D element. Handles:
- Drawing the curve path for all curve types (passthrough, flat, basic/extended/sigmoid, bezier)
- Draggable min/max control nodes for extended/sigmoid curves (basic pins its ranges, so it has no nodes)
- Full bezier point editing (drag anchors and handles, add/remove points via buttons or context menu)
- Live pressure indicators (raw = purple, effective = green) with dashed crosshair guides
- Chart export (copy PNG to clipboard, save JPEG)
- Hosting format toggles, curve controls, and the response chart

Its canvas is sized in JS from `#panel-left`'s `clientWidth`, backed at `devicePixelRatio` resolution. The resize returns early when the panel has no layout box, so collapsing does not re-fit the chart down to its 160px floor.

### PressureChartFormat.svelte
Six checkboxes controlling chart display: grid, labels, nodes, node guides, raw indicator, effective indicator. Node-related toggles are disabled when no editable curve is active.

### PressureCurveControls.svelte
The **DetailsPanel** — all sections are collapsible via CollapsibleSection. Contains:
- **Curve** (expanded by default): curve type dropdown with reset button, conditional controls per type:
  - **passthrough**: no controls
  - **flat**: height slider
  - **basic**: Curve Amount slider only (selecting it resets input/output ranges to 0–1 and min approach to clamp)
  - **extended/sigmoid**: Curve Amount slider, read-only node values table (driven by chart nodes), min approach radio buttons
  - **bezier**: preset dropdown, add/remove point buttons
- **Smoothing**: Smoothing Amount slider
- **Processing Order**: smooth-then-curve vs curve-then-smooth radio buttons (default: curve-then-smooth)
- **Presets**: save (via modal dialog)/load/delete user presets via localStorage

### PressureSmoothingControls.svelte
Thin wrapper around NamedSlider for the pressure EMA amount.

### SmoothingOrderControls.svelte
Radio pair selecting where smoothing sits relative to the curve: smooth-then-curve or curve-then-smooth. Its own DetailsPanel card ("Processing Order"), separate from the smoothing amount.

### PressureResponsePanel.svelte
Panel for loading pen hardware pressure response data. Offers a unified dropdown with three bundled Wacom KP-504E samples (WAP.0038, WAP.0047, WAP.0050) and an "Upload JSON..." option. Includes a "Show effect of curve" checkbox. Fires callbacks to PressureChart when data or checkbox state changes. Hosted in the curve panel's collapsible Pressure Response section.

### CollapsibleSection.svelte
Reusable section wrapper with clickable header that toggles content visibility. Used throughout DetailsPanel and the curve panel.

### PressureResponseChart.svelte
Standalone canvas chart rendering a pen's physical pressure response (grams-force vs logical %). When "show effect of curve" is enabled, applies the current pressure curve to the Y values, and the Y axis label switches from `LOGICAL %` to `OUTPUT %`. Draws live indicators on the response curve matching the main chart's indicators.

### NamedSlider.svelte
Reusable labeled slider component. Features: click-to-edit value display, right-click context menu (min/max/reset), optional non-linear (power-law curved) slider response, configurable display formatting.

### DrawingCanvas.svelte
Split drawing surface with two canvases. The top canvas ("Pressure processing: ON") renders strokes using the full pressure pipeline (EMA smoothing + curve application). The bottom canvas ("Pressure processing: OFF") renders the same strokes using raw unprocessed pen pressure. Drawing in either half mirrors to the other, allowing direct visual comparison. Displays live info via DrawingCanvasHeader. Clear via Delete/Backspace or button.

Both canvases are backed at real screen-pixel resolution (see [Canvas resolution](#canvas-resolution) below).

### DrawingCanvasHeader.svelte
Toolbar showing pointer type, pressure flow values (raw -> intermediate -> output), tilt angles, azimuth, altitude, and the collapse-panels, clear, color, pressure-control and brush-size controls. The collapse toggle lives here because the toolbar is the one region visible in both collapsed and expanded states.

## Shared utilities

| Module | Purpose |
|---|---|
| `curveMath.js` | Pure math: curve evaluation, bezier normalization, Hermite interpolation |
| `curveTypes.js` | `CURVE_TYPE` enum for all curve type identifiers |
| `uiConstants.js` | `SMOOTHING_ORDER`, `MIN_APPROACH`, `HANDLE_MODE`, `COLOR_MODE`, `PRESSURE_CONTROL` enums |
| `bezierPresets.js` | Built-in bezier curve preset point definitions |
| `canvasConstants.js` | Shared padding/spacing values for canvas charts |
| `canvasUtils.js` | Shared canvas drawing: background, grid, axis labels, indicator dots |
| `emaConstants.js` | EMA smoothing constants (max, midpoint target, curve exponent) |
| `fileNames.js` | `timestampedFileName(base, ext)` for export downloads |

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
App.svelte (params, livePressure, liveRawPressure, leftPanelsCollapsed)
  |
  |-- bind:params --> PressureChart --> PressureCurveControls (sliders modify params)
  |
  |-- params (read) --> DrawingCanvas
  |     |
  |     |-- bind:livePressure --> App
  |     |-- bind:liveRawPressure --> App
  |     |-- onToggleLeftPanels --> App
```

Components update params via `patchParams({ key: value })` which spreads into a new object, triggering Svelte reactivity. The chart re-renders whenever params, live pressure values, or display toggles change.

## Data flow

```
+---------------------------------------------------------+
|  App.svelte                                             |
|  State: params, livePressure, liveRawPressure,          |
|         leftPanelsCollapsed                             |
+----------------+------------------+---------------------+
                 | bind:params      | params (read)
                 | livePressure     | bind:livePressure
                 | liveRawPressure  | bind:liveRawPressure
                 v                  v
  +----------------------------+  +-----------------------+
  |  PressureChart             |  |  DrawingCanvas        |
  |  State: pressureResponse   |  |  (pointer input)      |
  |         showCurveEffect    |  |                       |
  |                            |  |  Raw pressure         |
  |  +----------------+        |  |    v EMA smooth       |
  |  |ChartFormat     |        |  |    v applyPressure    |
  |  +----------------+        |  |      Curve()          |
  |  +----------------+        |  |    v brush size       |
  |  |ResponseChart   |<-data--+  |                       |
  |  |  params        |<-parm--+  |  livePressure ------> |
  |  |  showEffect    |<-bool--+  |  liveRawPressure ---> |
  |  +----------------+        |  |  onToggleLeftPanels-> |
  |  +----------------+        |  +-----------------------+
  |  |CurveControls   |        |
  |  | + SmoothingCtrl|        |
  |  | + NamedSliders |        |
  |  | + ResponsePanel|--cb--->| (data + showEffect callbacks)
  |  +----------------+        |
  +----------------------------+
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
| `emaSmoothing` | number | 0-0.99 | Pressure EMA smoothing amount |
| `smoothingOrder` | string | `'smooth-then-curve'`, `'curve-then-smooth'` | Pipeline order |

Each bezier point is `{ x, y, inX, inY, outX, outY, handleMode }`, where `handleMode` is `'broken'` or `'mirrored'` and points are sorted by `x`.

User presets store a deep copy of this object in localStorage. Loading replaces `params` wholesale, so presets saved under an older schema still load — unknown keys simply go unread.

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
| [src/lib/PressureResponsePanel.svelte](../src/lib/PressureResponsePanel.svelte) | Component | Load/select pen response data |
| [src/lib/PressureSmoothingControls.svelte](../src/lib/PressureSmoothingControls.svelte) | Component | Pressure EMA amount |
| [src/lib/SmoothingOrderControls.svelte](../src/lib/SmoothingOrderControls.svelte) | Component | Smoothing order radios |
| [src/lib/CollapsibleSection.svelte](../src/lib/CollapsibleSection.svelte) | Component | Reusable collapsible section |
| [src/lib/NamedSlider.svelte](../src/lib/NamedSlider.svelte) | Component | Reusable labeled slider |
| [src/lib/DrawingCanvas.svelte](../src/lib/DrawingCanvas.svelte) | Component | Drawing surface + pressure input |
| [src/lib/DrawingCanvasHeader.svelte](../src/lib/DrawingCanvasHeader.svelte) | Component | Drawing toolbar + info |
| [src/lib/curveMath.js](../src/lib/curveMath.js) | Utility | Pressure curve math |
| [src/lib/curveTypes.js](../src/lib/curveTypes.js) | Utility | `CURVE_TYPE` enum |
| [src/lib/uiConstants.js](../src/lib/uiConstants.js) | Utility | UI enums |
| [src/lib/bezierPresets.js](../src/lib/bezierPresets.js) | Utility | Bezier preset definitions |
| [src/lib/canvasConstants.js](../src/lib/canvasConstants.js) | Utility | Chart padding/spacing |
| [src/lib/canvasUtils.js](../src/lib/canvasUtils.js) | Utility | Shared canvas drawing |
| [src/lib/emaConstants.js](../src/lib/emaConstants.js) | Utility | EMA smoothing constants |
| [src/lib/fileNames.js](../src/lib/fileNames.js) | Utility | Timestamped export filenames |
| [sample-pressure-response/](../sample-pressure-response/) | Data | Bundled pen response JSON files |
