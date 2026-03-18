# WebPressureExplorer Architecture

## Overview

WebPressureExplorer is a Svelte 5 web application for exploring and visualizing pressure curves used in digital drawing applications. Users can configure pressure curve algorithms, preview their effects on an interactive chart, and test them by drawing with pressure-sensitive input.

**Tech Stack:** Svelte 5, Vite 6, Canvas 2D API

---

## Component Hierarchy

```
App.svelte (root — state owner)
├── PressureChart.svelte           (left panel: curve visualization & interaction)
│   ├── PressureChartFormat.svelte (display toggles: grid, labels, nodes)
│   └── PressureCurveControls.svelte (curve type + parameter sliders)
│       ├── PositionControls.svelte  (position EMA smoothing)
│       │   └── NamedSlider.svelte
│       ├── PressureSmoothingControls.svelte (pressure EMA + order)
│       │   └── NamedSlider.svelte
│       └── NamedSlider.svelte       (multiple instances for curve params)
└── DrawingCanvas.svelte           (right panel: drawing area)
    └── DrawingCanvasHeader.svelte  (toolbar: info display + clear button)
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

**Responsibilities:**
- Renders the curve, grid, axis labels, control nodes, and bezier handles via Canvas 2D
- Handles pointer events for dragging control points and handles (custom curve mode)
- Provides a right-click context menu to insert/delete custom curve points
- Exports the chart as PNG (copy to clipboard) or JPEG (save file)
- Hosts `PressureChartFormat` and `PressureCurveControls` as children

**Dependencies:** [curveMath.js](#curvemathjs), `PressureChartFormat`, `PressureCurveControls`

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
**Callbacks:** `onAddCustomPoint`, `onRemoveCustomPoint`

**Conditional rendering:**
| Curve type | Controls shown |
|---|---|
| `null-effect` | None (no controls, no reset) |
| `flat` | Height slider |
| `power` / `sigmoid` | CurveAmount, InputMin, InputMax, OutputMin, OutputMax sliders |
| `custom` | Add/Remove point buttons |
| Any except null | Reset button |

**Children:** `PositionControls`, `PressureSmoothingControls`, `NamedSlider` (multiple)

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

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  App.svelte                                             │
│  State: params, livePressure                            │
└────────────────┬──────────────────┬─────────────────────┘
                 │ bind:params      │ params (read)
                 │ livePressure     │ bind:livePressure
                 ▼                  ▼
  ┌──────────────────────┐  ┌──────────────────────┐
  │  PressureChart       │  │  DrawingCanvas        │
  │  (visualization)     │  │  (pointer input)      │
  │                      │  │                       │
  │  ┌────────────────┐  │  │  Raw pressure         │
  │  │ChartFormat     │  │  │    ↓ EMA smooth       │
  │  │(display toggles│  │  │    ↓ applyPressure    │
  │  └────────────────┘  │  │      Curve()          │
  │  ┌────────────────┐  │  │    ↓ brush size       │
  │  │CurveControls   │  │  │                       │
  │  │ ├ PositionCtrl │  │  │  livePressure ──────► │
  │  │ ├ SmoothingCtrl│  │  │  (sent to Chart)      │
  │  │ └ NamedSliders │  │  └──────────────────────┘
  │  └────────────────┘  │
  └──────────────────────┘
```

---

## File Index

| File | Type | Purpose |
|---|---|---|
| [src/App.svelte](src/App.svelte) | Component | Root, state owner |
| [src/lib/PressureChart.svelte](src/lib/PressureChart.svelte) | Component | Curve chart & host for controls |
| [src/lib/PressureChartFormat.svelte](src/lib/PressureChartFormat.svelte) | Component | Chart display toggles |
| [src/lib/PressureCurveControls.svelte](src/lib/PressureCurveControls.svelte) | Component | Curve type + sliders |
| [src/lib/PressureSmoothingControls.svelte](src/lib/PressureSmoothingControls.svelte) | Component | Pressure EMA controls |
| [src/lib/PositionControls.svelte](src/lib/PositionControls.svelte) | Component | Position EMA control |
| [src/lib/NamedSlider.svelte](src/lib/NamedSlider.svelte) | Component | Reusable labeled slider |
| [src/lib/DrawingCanvas.svelte](src/lib/DrawingCanvas.svelte) | Component | Drawing surface + pressure input |
| [src/lib/DrawingCanvasHeader.svelte](src/lib/DrawingCanvasHeader.svelte) | Component | Drawing toolbar + info |
| [src/lib/curveMath.js](src/lib/curveMath.js) | Utility | Pressure curve math |
| [src/main.js](src/main.js) | Entry point | Mounts App to DOM |
| [src/app.css](src/app.css) | Styles | Global styles |
