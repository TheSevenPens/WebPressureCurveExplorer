# WebPressureExplorer Overview

WebPressureExplorer is a browser-based tool for exploring, configuring, and testing pressure curves used in digital drawing applications. It targets artists, pen tablet users, and developers who want to understand or fine-tune how physical pen pressure maps to brush output.

## What it does

The app has a fixed left column and a right pane that switches between two views:

- **Pressure Curve Editor** (left) — An interactive chart where users select a curve type (passthrough, flat, basic, extended, sigmoid, or bezier), adjust parameters via sliders and draggable control nodes, and see the resulting pressure mapping function in real time.

- **View pane** (right) — Two stacked toolbars over the active view. The first reports live pen data and is the same in both views; the second holds the view switcher and whichever controls that view needs. The pane switches between:
  - **Canvas** — A split drawing surface with two halves. The top half ("Pressure processing: ON") applies the full pressure pipeline (smoothing + curve). The bottom half ("Pressure processing: OFF") uses raw unprocessed pen pressure. Drawing in either half mirrors the stroke to the other, making it easy to compare the effect of pressure processing side by side.
  - **Pressure Response** — The pen hardware response chart at full pane size. It captures pen pressure without drawing, so you can press the pen and watch the live indicators move along your hardware's actual force curve.

## Key features

- **Six curve types** — passthrough (identity), flat (constant), basic (power law, CurveAmount only), extended (power law with full input/output range controls), sigmoid (S-curve), and bezier (custom cubic bezier with up to 16 points)
- **Bezier presets** — built-in preset shapes (Linear, Soft, Firm, S-Curve, Light Touch, Heavy, Step) for quick bezier curve setup
- **Draggable control nodes** on the chart for extended/sigmoid curves to set input/output ranges visually
- **Full bezier editor** with adjustable handles, mirrored/broken handle modes, and right-click context menu
- **Smoothing types** — passthrough (none) or EMA, selected from a dropdown like the curve type, with configurable application order (smooth-then-curve by default, or curve-then-smooth)
- **On/off status in card titles** — the Curve and Smoothing cards report whether that stage is actually changing the pressure, so a collapsed card still tells you. A curve that is mathematically neutral reads "off" even when a curve type is selected
- **Min approach modes** (clamp vs cut) controlling how the curve behaves below the input minimum
- **Live pressure indicators** on the chart showing raw (purple) and effective (green) pressure positions in real time
- **Pressure response data** — load pen hardware measurement data (physical grams-force vs logical pressure %) from bundled samples or uploaded JSON files, with optional curve overlay, shown full-pane in Pressure Response view
- **Collapsible controls** — a single toolbar button hides both left panels to maximize drawing area; strokes survive the toggle
- **Export** — copy charts and drawing canvases to clipboard as PNG or save as image files, with a local-time stamp in every saved filename
- **Split canvas comparison** — draw once, see the stroke rendered with and without pressure processing simultaneously
- **Brush controls** — adjustable brush size (1-500px), stroke color mode (black or random), pressure controls (size or opacity)
- **User presets** — save, load (with confirmation), and delete named parameter configurations via localStorage
- **Direct value editing** — click any slider value to type an exact number; right-click sliders for min/max/reset
- **Driver warning** — dismissable banner reminding users to set their tablet driver's pressure curve to default

## Tech stack

- **Svelte 5** — component framework
- **Vite 6** — build tool and dev server
- **Canvas 2D API** — all chart and drawing rendering
- **Inter** — primary font, loaded from Google Fonts (Segoe UI fallback)
- **No external UI libraries** — pure CSS styling, zero runtime dependencies

## Running the app

```bash
npm install
npm run dev      # Start dev server (default: http://localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Project structure

```
src/
  App.svelte                    Root component, state owner
  main.js                       Entry point
  app.css                       Global styles
  lib/
    ViewPanel.svelte            Right pane: toolbars + view switching
    PenDataToolbar.svelte       Toolbar 1: live pen readouts
    CanvasControls.svelte       Toolbar 2: canvas-mode controls
    ResponseControls.svelte     Toolbar 2: response-mode controls
    PressureResponseView.svelte Response view body
    PressureChart.svelte        Curve chart + interaction + export
    PressureChartFormat.svelte  Display toggle checkboxes
    PressureCurveControls.svelte  DetailsPanel: curve type selector + parameter sliders
    PressureResponseChart.svelte  Pen hardware response data chart
    PressureSmoothingControls.svelte  Pressure smoothing amount
    SmoothingOrderControls.svelte  Smoothing order radios
    CollapsibleSection.svelte   Reusable collapsible section wrapper
    NamedSlider.svelte          Reusable slider with edit mode + context menu
    DrawingCanvas.svelte        Split pressure-sensitive drawing surface
    curveMath.js                Pure math: curve evaluation + bezier
    curveTypes.js               CURVE_TYPE enum constants
    uiConstants.js              UI enums (smoothing order, min approach, handle mode, color mode, pressure control)
    bezierPresets.js            Built-in bezier curve preset definitions
    canvasConstants.js          Shared canvas padding/spacing constants
    canvasUtils.js              Shared canvas drawing utilities
    emaConstants.js             Shared EMA smoothing constants
    fileNames.js                Timestamped export filename helper
    pressurePipeline.js         Shared smoothing state + pen info builder
sample-pressure-response/       Bundled pen hardware measurement JSON files
docs/                           Documentation
```
