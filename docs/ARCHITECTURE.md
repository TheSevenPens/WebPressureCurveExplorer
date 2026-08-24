# Architecture

## Component hierarchy

```
App.svelte (root - state owner)
  PressureChart.svelte               (left panel: curve visualization + interaction)
    PressureChartFormat.svelte       (display toggles: grid, labels, nodes, indicators)
    PressureResponseChart.svelte     (pen hardware response data chart)
    PressureCurveControls.svelte     (DetailsPanel: curve type selector + parameter sliders)
      PressureSmoothingControls.svelte (pressure EMA + order)
        NamedSlider.svelte
      NamedSlider.svelte             (multiple instances for curve params)
      PressureResponsePanel.svelte   (load/select pen response data)
  DrawingCanvas.svelte               (right panel: drawing area)
    DrawingCanvasHeader.svelte       (toolbar: live info + clear button)
```

## Component roles

### App.svelte
Single source of truth. Owns the `params` object, `livePressure`, and `liveRawPressure`. Passes `params` down to both panels; receives live pressure values back from DrawingCanvas via bindings. Disables browser context menu globally.

### PressureChart.svelte
Largest component. Renders the pressure curve chart on a Canvas 2D element. Handles:
- Drawing the curve path for all curve types (null-effect, flat, basic/sigmoid, bezier)
- Draggable min/max control nodes for basic/sigmoid curves
- Full bezier point editing (drag anchors and handles, add/remove points via buttons or context menu)
- Live pressure indicators (raw = purple, effective = green) with dashed crosshair guides
- Chart export (copy PNG to clipboard, save JPEG)
- Hosting format toggles, curve controls, and the response chart

### PressureChartFormat.svelte
Six checkboxes controlling chart display: grid, labels, nodes, node guides, raw indicator, effective indicator. Node-related toggles are disabled when no editable curve is active.

### PressureCurveControls.svelte
The **DetailsPanel** — all sections are collapsible via CollapsibleSection. Contains:
- **Pressure Curve** (expanded by default): curve type dropdown with reset button, conditional controls per type:
  - **passthrough**: no controls
  - **flat**: height slider
  - **basic**: Curve Amount slider only
  - **extended/sigmoid**: Curve Amount slider, read-only node values table (driven by chart nodes), min approach radio buttons
  - **bezier**: preset dropdown, add/remove point buttons
- **Pressure Smoothing**: Smoothing Amount slider, smoothing order radio buttons
- **Presets**: save (via modal dialog)/load/delete user presets via localStorage

### PressureSmoothingControls.svelte
Thin wrapper around NamedSlider for pressure smoothing. Also includes smoothing order radio buttons (smooth-then-curve vs curve-then-smooth).

### PressureResponsePanel.svelte
Panel for loading pen hardware pressure response data. Offers a unified dropdown with three bundled Wacom KP-504E samples and an "Upload JSON..." option. Includes a "Show effect of curve" checkbox. Fires callbacks to PressureChart when data or checkbox state changes. Hosted in the curve panel's collapsible Pressure Response section.

### CollapsibleSection.svelte
Reusable section wrapper with clickable header that toggles content visibility. Used throughout DetailsPanel and the curve panel.

### PressureResponseChart.svelte
Standalone canvas chart rendering a pen's physical pressure response (grams-force vs logical %). When "show effect of curve" is enabled, applies the current pressure curve to the Y values. Draws live indicators on the response curve matching the main chart's indicators.

### NamedSlider.svelte
Reusable labeled slider component. Features: click-to-edit value display, right-click context menu (min/max/reset), optional non-linear (power-law curved) slider response, configurable display formatting.

### DrawingCanvas.svelte
Split drawing surface with two canvases. The top canvas ("Pressure processing: ON") renders strokes using the full pressure pipeline (EMA smoothing + curve application). The bottom canvas ("Pressure processing: OFF") renders the same strokes using raw unprocessed pen pressure. Drawing in either half mirrors to the other, allowing direct visual comparison. Displays live info via DrawingCanvasHeader. Clear via Delete/Backspace or button.

### DrawingCanvasHeader.svelte
Toolbar showing pointer type, pressure flow values (raw -> intermediate -> output), tilt angles, azimuth, altitude, and a clear button.

## Shared utilities

| Module | Purpose |
|---|---|
| `curveMath.js` | Pure math: curve evaluation, bezier normalization, Hermite interpolation |
| `curveTypes.js` | `CURVE_TYPE` enum for all curve type identifiers |
| `bezierPresets.js` | Built-in bezier curve preset point definitions |
| `canvasConstants.js` | Shared padding/spacing values for canvas charts |
| `canvasUtils.js` | Shared canvas drawing: background, grid, axis labels, indicator dots |
| `emaConstants.js` | EMA smoothing constants (max, midpoint target, curve exponent) |

## State management

All application state flows through a single `params` object owned by App.svelte:

```
App.svelte (params, livePressure, liveRawPressure)
  |
  |-- bind:params --> PressureChart --> PressureCurveControls (sliders modify params)
  |
  |-- params (read) --> DrawingCanvas
  |     |
  |     |-- bind:livePressure --> App
  |     |-- bind:liveRawPressure --> App
```

Components update params via `patchParams({ key: value })` which spreads into a new object, triggering Svelte reactivity. The chart re-renders whenever params, live pressure values, or display toggles change.

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
| `transitionWidth` | number | 0-0.5 | Hermite transition smoothing width |
| `bezierPoints` | array | 2-16 points | Bezier curve control points |
| `emaSmoothing` | number | 0-0.99 | Pressure EMA smoothing amount |
| `smoothingOrder` | string | `'smooth-then-curve'`, `'curve-then-smooth'` | Pipeline order |

## Pressure response data schema

JSON files loaded via PressureResponsePanel:

```json
{
  "brand": "WACOM",
  "pen": "KP-504E",
  "inventoryid": "WAP.0038",
  "date": "2025-11-10",
  "tablet": "PTH-870",
  "records": [
    [82.0, 51.41],
    ...
  ]
}
```

Each record: `[gramForce, logicalPressurePercent]`. Records sorted by ascending gram-force.

## Key design points

1. **No runtime dependencies** — Svelte 5 + Vite 6 only. All rendering uses Canvas 2D API directly.
2. **Single state owner** — App.svelte owns params; child components either bind or receive read-only props.
3. **Pure math separation** — curveMath.js has no Svelte dependencies. It can be imported by any component or tested independently.
4. **Canvas-first rendering** — Both the curve chart and drawing surface use HTML Canvas for performance. No SVG or DOM-based charting.
5. **Shared canvas utilities** — Grid, background, labels, and indicator rendering are extracted to canvasUtils.js to avoid duplication between PressureChart and PressureResponseChart.
