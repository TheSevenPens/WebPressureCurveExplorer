# WebPressureExplorer Architecture

## Overview

WebPressureExplorer is a Svelte 5 web application for exploring and visualizing pressure curves used in digital drawing applications. Users can configure pressure curve algorithms, preview their effects on an interactive chart, and test them by drawing with pressure-sensitive input.

**Tech Stack:** Svelte 5, Vite 6, Canvas 2D API

---

## Component Hierarchy

```
App.svelte (root — state owner)
├── PressureChart.svelte               (left panel: curve visualization & interaction)
│   ├── PressureChartFormat.svelte     (display toggles: grid, labels, nodes)
│   ├── PressureResponseChart.svelte   (separate chart for pen hardware response data)
│   └── PressureCurveControls.svelte   (curve type + parameter sliders)
│       ├── PositionControls.svelte      (position EMA smoothing)
│       │   └── NamedSlider.svelte
│       ├── PressureSmoothingControls.svelte (pressure EMA + order)
│       │   └── NamedSlider.svelte
│       ├── NamedSlider.svelte           (multiple instances for curve params)
│       └── PressureResponsePanel.svelte (load/select pen response data)
└── DrawingCanvas.svelte               (right panel: drawing area)
    └── DrawingCanvasHeader.svelte     (toolbar: info display + clear button)
```

---

## Component Reference

### `App.svelte`
**Role:** Root component and single source of truth for application state.

**State managed here:**
- `params` — the full configuration object (see [Data Model](#data-model) below)
- `livePressure` — current pressure value while drawing (drives the live indicator on the chart)

**Data flow:**
- Passes `params` down to both `PressureChart` and `DrawingCanvas`
- `PressureChart` binds `params` (can update it via controls)
- `DrawingCanvas` binds `livePressure` (updates it on pointer move)

---

### `PressureChart.svelte`
**Role:** Interactive canvas-based visualization of the pressure curve. Also serves as the host for all curve configuration controls.

**Inputs:**
- `params` (bindable) — curve configuration
- `livePressure` — position of the live pressure indicator on the curve
- `defaultParams` — used by the reset button

**Internal state:**
- `pressureResponseData` — loaded pen hardware response dataset (null by default)
- `showResponseCurveEffect` — mirrors the "show effect of curve" checkbox in `PressureResponsePanel`

**Responsibilities:**
- Renders the curve, grid, axis labels, control nodes, and bezier handles via Canvas 2D
- Draws the **live pressure indicator** — a dot that travels along the curve at the current `livePressure` position, with dashed crosshair lines to both axes. Drawn inline at the end of `drawCurveCanvas()`; fed by the `livePressure` prop.
- Handles pointer events for dragging control points and handles (custom curve mode)
- Provides a right-click context menu to insert/delete custom curve points
- Exports the chart as PNG (copy to clipboard) or JPEG (save file)
- Hosts `PressureChartFormat`, `PressureCurveControls`, and (conditionally) `PressureResponseChart`
- Owns response data state; receives change callbacks from `PressureResponsePanel` via `PressureCurveControls` and forwards `params` + `showCurveEffect` to `PressureResponseChart`

**Dependencies:** [curveMath.js](#curvemathjs), `PressureChartFormat`, `PressureCurveControls`, `PressureResponseChart`

---

### `PressureChartFormat.svelte`
**Role:** Four checkboxes to toggle chart display options.

**Props (all bindable):** `showGrid`, `showLabels`, `showNodes`, `showNodeGuides`, `curveActive` (disables node toggles when no active curve), `onToggle` callback

**Parent:** `PressureChart`

---

### `PressureCurveControls.svelte`
**Role:** Curve type selector and all parameter sliders. Conditionally renders controls based on the active curve type.

**Props (bindable):** `params`, `defaultParams`
**Props (read):** `curveActive`, `flatActive`, `customActive`, `canAddCustomPoint`, `canRemoveCustomPoint`
**Callbacks:** `onAddCustomPoint`, `onRemoveCustomPoint`, `onResponseDataChange`, `onResponseShowCurveEffectChange`

**Conditional rendering:**
| Curve type | Controls shown |
|---|---|
| `null-effect` | None (no controls, no reset) |
| `flat` | Height slider |
| `power` / `sigmoid` | CurveAmount, InputMin, InputMax, OutputMin, OutputMax sliders |
| `custom` | Add/Remove point buttons |
| Any except null | Reset button |

**Children:** `PositionControls`, `PressureSmoothingControls`, `NamedSlider` (multiple), `PressureResponsePanel`

**Parent:** `PressureChart`

---

### `PositionControls.svelte`
**Role:** Single slider for position EMA (cursor position smoothing).

**Props (bindable):** `params`
**Updates:** `params.positionEmaSmoothing`

**Children:** `NamedSlider`
**Parent:** `PressureCurveControls`

---

### `PressureSmoothingControls.svelte`
**Role:** Controls for pressure input smoothing: EMA amount and application order.

**Props (bindable):** `params`
**Updates:** `params.emaSmoothing`, `params.smoothingOrder`

**Children:** `NamedSlider`, a `<select>` for smoothing order
**Parent:** `PressureCurveControls`

---

### `PressureResponsePanel.svelte`
**Role:** Collapsible power-user panel for loading pen hardware pressure response data. Hidden by default; revealed by a toggle button at the bottom of the controls panel.

**Props (callbacks):** `onDataChange(data)`, `onShowCurveEffectChange(value)`

**Features:**
- Dropdown to select one of three bundled sample datasets (WAP.0038, WAP.0047, WAP.0050 — all Wacom KP-504E units)
- "Upload JSON" button to load any file matching the response data schema
- "Show effect of curve" checkbox (checked by default) — passed up via `onShowCurveEffectChange`
- Info badge showing the loaded pen's inventory ID, model, tablet, and date
- Clear button to unload data

**Sample data imports:** `../../sample-pressure-response/WAP.0038_2025-11-10.json`, `WAP.0047_…`, `WAP.0050_…` (bundled at build time via Vite JSON imports)

**Parent:** `PressureCurveControls`

---

### `PressureResponseChart.svelte`
**Role:** Standalone canvas chart that visualises a pen's hardware pressure response. Rendered below the main pressure curve chart in `panel-left`, only when response data is loaded.

**Props:**
- `data` — loaded response dataset (nullable)
- `params` — curve configuration, used when `showCurveEffect` is true
- `showCurveEffect` — when true, applies `applyPressureCurve` to each data point's Y value

**Chart axes:**
- **X** — physical force in gram-force (gf), range 0 to max measured gf
- **Y** — logical pressure % (0–100) when `showCurveEffect` is false; curve output % when true

**Y axis label:** `LOGICAL %` (unchecked) or `OUTPUT %` (checked)

**Dependencies:** [curveMath.js](#curvemathjs) (`applyPressureCurve`)

**Parent:** `PressureChart`

---

### `NamedSlider.svelte`
**Role:** Reusable labeled slider with optional curved (power-law) response mapping. Displays formatted value next to the label.

**Key props:**
- `name` — label text
- `value`, `min`, `max`, `step` — value range
- `sliderMin`, `sliderMax`, `sliderStep` — UI range (can differ from value range)
- `curved`, `curveExponent` — enable non-linear slider feel
- `valueDecimals`, `valuePrecision` — display formatting
- `onValueChange` — callback with the new value

**Parents:** `PressureCurveControls`, `PositionControls`, `PressureSmoothingControls`

---

### `DrawingCanvas.svelte`
**Role:** Interactive drawing surface. Captures pointer pressure and applies the curve pipeline, then renders pressure-responsive brush strokes.

**Props:**
- `params` — curve configuration (read-only)
- `livePressure` (bindable) — outputs current pressure to `App`

**Pressure pipeline (per pointer event):**
```
Raw pressure
  → EMA smoothing (getSmoothedPressure)        [if smoothingOrder = "smooth-then-curve"]
  → applyPressureCurve (curveMath.js)
  → EMA smoothing (getSmoothedPressure)        [if smoothingOrder = "curve-then-smooth"]
  → brush size = output × MAX_BRUSH_SIZE (40px)
```

**Responsibilities:**
- Captures `pointermove` / `pointerdown` events (supports pen, mouse, touch)
- Maintains EMA state for pressure and position smoothing
- Draws line segments with width proportional to processed pressure
- Displays live info (raw pressure, tilt, azimuth, altitude) via `DrawingCanvasHeader`
- Clear canvas on Delete/Backspace key or via header button

**Dependencies:** [curveMath.js](#curvemathjs), `DrawingCanvasHeader`

---

### `DrawingCanvasHeader.svelte`
**Role:** Toolbar above the drawing canvas. Shows a clear button and live pointer info.

**Props:**
- `info` — `{ pressure, tilt, azimuth, altitude }` display values
- `onClear` — callback for clear button
- `el` (bindable) — exposes the toolbar element reference to parent (used for canvas sizing)

**Parent:** `DrawingCanvas`

---

## Utility: `curveMath.js`

Pure math module with no Svelte dependencies. Exports one primary function used by both `PressureChart` and `DrawingCanvas`:

### `applyPressureCurve(x, params) → number`
The main entry point. Applies the full pressure transformation:
1. Normalize raw input using `[inputMinimum, inputMaximum]`
2. Apply the selected curve algorithm
3. Apply boundary transition smoothing (cubic Hermite) if `transitionWidth > 0`
4. Scale result to `[minimum, maximum]`

**Curve algorithms:**
| `curveType` | Algorithm |
|---|---|
| `null-effect` | Pass-through (`x` unchanged) |
| `flat` | Return `flatLevel` constant |
| `power` | Power law: exponent derived from `softness` |
| `sigmoid` | Logistic function: `k = softness × 14` |
| `custom` | Cubic Bezier evaluation via binary search |

**Internal helpers:**
- `rawCurveOutput(xNorm, params)` — sigmoid/power calculation
- `rawCurveSlope(xNorm, params)` — numerical derivative (for Hermite transitions)
- `cubicHermite(t, y0, m0, y1, m1)` — cubic Hermite interpolation
- `normalizeCustomPoints(points)` — validate/sort/clamp bezier control points
- `buildCustomSegments(points)` — convert points to bezier segment definitions
- `cubicAt(t, p0, c0, c1, p1)` — evaluate cubic Bezier at parameter `t`
- `solveBezierTForX(x, segment)` — binary search for `t` given `x` (28 iterations)
- `evaluateCustomCurve(x, points)` — full custom curve evaluation

---

## Data Model

The `params` object is the central data structure passed through the entire app:

```js
{
  // Curve type
  curveType: 'null-effect' | 'flat' | 'power' | 'sigmoid' | 'custom',

  // Pressure input remapping
  inputMinimum: number,   // 0–1
  inputMaximum: number,   // 0–1

  // Pressure output remapping
  minimum: number,        // 0–1
  maximum: number,        // 0–1

  // Curve shape (power/sigmoid)
  softness: number,       // -0.9–0.9

  // Flat curve
  flatLevel: number,      // 0–1

  // Boundary transition smoothing
  transitionWidth: number, // 0–0.5

  // Custom bezier control points (2–16 points)
  customPoints: [
    {
      x: number, y: number,         // Point position (sorted by x)
      inX: number, inY: number,     // Incoming handle
      outX: number, outY: number,   // Outgoing handle
      handleMode: 'broken' | 'mirrored'
    },
    ...
  ],

  // Smoothing
  emaSmoothing: number,            // 0–0.99 (pressure EMA)
  positionEmaSmoothing: number,    // 0–0.99 (cursor position EMA)
  smoothingOrder: 'smooth-then-curve' | 'curve-then-smooth'
}
```

---

## Pressure Response Data Schema

JSON files in `sample-pressure-response/` (and accepted via file upload) follow this schema:

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

Each record is one empirical measurement: the physical force applied in **gram-force (gf)** and the logical pressure value the pen reported to the OS as a **percentage (0–100)**. Records are sorted by ascending gram-force.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  App.svelte                                             │
│  State: params, livePressure                            │
└────────────────┬──────────────────┬─────────────────────┘
                 │ bind:params      │ params (read)
                 │ livePressure     │ bind:livePressure
                 ▼                  ▼
  ┌────────────────────────────┐  ┌──────────────────────┐
  │  PressureChart             │  │  DrawingCanvas        │
  │  State: pressureResponse   │  │  (pointer input)      │
  │         showCurveEffect    │  │                       │
  │                            │  │  Raw pressure         │
  │  ┌────────────────┐        │  │    ↓ EMA smooth       │
  │  │ChartFormat     │        │  │    ↓ applyPressure    │
  │  └────────────────┘        │  │      Curve()          │
  │  ┌────────────────┐        │  │    ↓ brush size       │
  │  │ResponseChart   │◄─data──┤  │                       │
  │  │  params        │◄─parm──┤  │  livePressure ──────► │
  │  │  showEffect    │◄─bool──┤  │  (sent to Chart)      │
  │  └────────────────┘        │  └──────────────────────┘
  │  ┌────────────────┐        │
  │  │CurveControls   │        │
  │  │ ├ PositionCtrl │        │
  │  │ ├ SmoothingCtrl│        │
  │  │ ├ NamedSliders │        │
  │  │ └ ResponsePanel│──cb───►│ (data + showEffect callbacks)
  │  └────────────────┘        │
  └────────────────────────────┘
```

---

## File Index

| File | Type | Purpose |
|---|---|---|
| [src/App.svelte](src/App.svelte) | Component | Root, state owner |
| [src/lib/PressureChart.svelte](src/lib/PressureChart.svelte) | Component | Curve chart & host for controls |
| [src/lib/PressureChartFormat.svelte](src/lib/PressureChartFormat.svelte) | Component | Chart display toggles |
| [src/lib/PressureResponseChart.svelte](src/lib/PressureResponseChart.svelte) | Component | Hardware response data chart |
| [src/lib/PressureCurveControls.svelte](src/lib/PressureCurveControls.svelte) | Component | Curve type + sliders |
| [src/lib/PressureResponsePanel.svelte](src/lib/PressureResponsePanel.svelte) | Component | Load/select pen response data |
| [src/lib/PressureSmoothingControls.svelte](src/lib/PressureSmoothingControls.svelte) | Component | Pressure EMA controls |
| [src/lib/PositionControls.svelte](src/lib/PositionControls.svelte) | Component | Position EMA control |
| [src/lib/NamedSlider.svelte](src/lib/NamedSlider.svelte) | Component | Reusable labeled slider |
| [src/lib/DrawingCanvas.svelte](src/lib/DrawingCanvas.svelte) | Component | Drawing surface + pressure input |
| [src/lib/DrawingCanvasHeader.svelte](src/lib/DrawingCanvasHeader.svelte) | Component | Drawing toolbar + info |
| [src/lib/curveMath.js](src/lib/curveMath.js) | Utility | Pressure curve math |
| [src/main.js](src/main.js) | Entry point | Mounts App to DOM |
| [src/app.css](src/app.css) | Styles | Global styles |
| [sample-pressure-response/](sample-pressure-response/) | Data | Bundled pen hardware response JSON files |
