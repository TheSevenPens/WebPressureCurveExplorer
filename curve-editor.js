// ── Curve Editor (left panel) ────────────────────────────────
// Curve canvas drawing, resize, and node drag interaction.
// Reads: params, applyPressureCurve (curve-math.js),
//        sliders, valueEls, formatValue (params.js).
// Exposes: drawCurveCanvas, livePressure (read by draw-canvas.js).


// ── Canvas setup ──────────────────────────────────────────────

const curvePanel  = document.getElementById('panel-left');
const curveCanvas = document.getElementById('curve-canvas');
const curveCtx    = curveCanvas.getContext('2d');

const DPR        = window.devicePixelRatio || 1;
const PAD_LEFT   = 42;   // room for Y-axis labels
const PAD_BOTTOM = 32;   // room for X-axis labels
const PAD_TOP    = 20;
const PAD_RIGHT  = 20;

const CURVE_COLOR            = '#000000';           // curve color (all three segments)
const MIN_CONTROL_NODE_COLOR = 'rgb(255, 0, 136)';  // minimum control node fill
const MIN_CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';
const MAX_CONTROL_NODE_COLOR = '#00d0ff';            // maximum control node fill
const MAX_CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';


// ── Render state ──────────────────────────────────────────────

// Current raw input pressure for the live indicator dot (null = hidden)
let livePressure = null;

let showGrid       = true;
let showLabels     = true;
let showNodes      = true;
let showNodeGuides = true;

let _lastCurveSize = 0;


// ── Drawing ───────────────────────────────────────────────────

function resizeCurveCanvas() {
  const size = Math.max(160, curvePanel.clientWidth - 24);
  if (size === _lastCurveSize) { drawCurveCanvas(); return; }
  _lastCurveSize = size;
  curveCanvas.style.width  = size + 'px';
  curveCanvas.style.height = size + 'px';
  curveCanvas.width        = Math.round(size * DPR);
  curveCanvas.height       = Math.round(size * DPR);
  curveCtx.resetTransform();   // clear any accumulated scale from previous resizes
  curveCtx.scale(DPR, DPR);
  drawCurveCanvas();
}

new ResizeObserver(resizeCurveCanvas).observe(curvePanel);

function drawCurveCanvas() {
  const W     = curveCanvas.width  / DPR;
  const H     = curveCanvas.height / DPR;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP  - PAD_BOTTOM;

  // Background
  curveCtx.fillStyle = '#ffffff';
  curveCtx.fillRect(0, 0, W, H);
  curveCtx.fillStyle = '#f7f7fb';
  curveCtx.fillRect(PAD_LEFT, PAD_TOP, plotW, plotH);

  // Grid lines
  if (showGrid) {
    curveCtx.strokeStyle = '#ebebf4';
    curveCtx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const gx = PAD_LEFT + (i / 5) * plotW;
      const gy = PAD_TOP  + (i / 5) * plotH;
      curveCtx.beginPath();
      curveCtx.moveTo(gx, PAD_TOP);
      curveCtx.lineTo(gx, PAD_TOP + plotH);
      curveCtx.stroke();
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT, gy);
      curveCtx.lineTo(PAD_LEFT + plotW, gy);
      curveCtx.stroke();
    }
  }

  // Axis tick labels
  if (showLabels) {
    curveCtx.fillStyle = '#000000';
    curveCtx.font = '9px Consolas, monospace';

    curveCtx.textAlign    = 'center';
    curveCtx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const gx = PAD_LEFT + (i / 5) * plotW;
      curveCtx.fillText((i * 0.2).toFixed(1), gx, PAD_TOP + plotH + 4);
    }

    curveCtx.textAlign    = 'right';
    curveCtx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const gy = PAD_TOP + plotH - (i / 5) * plotH;
      curveCtx.fillText((i * 0.2).toFixed(1), PAD_LEFT - 4, gy);
    }

    // X axis title
    curveCtx.fillStyle    = '#000000';
    curveCtx.font         = '9px Segoe UI, sans-serif';
    curveCtx.textAlign    = 'center';
    curveCtx.textBaseline = 'bottom';
    curveCtx.fillText('Input logical pressure', PAD_LEFT + plotW / 2, H - 1);

    // Y axis title (rotated)
    curveCtx.save();
    curveCtx.translate(9, PAD_TOP + plotH / 2);
    curveCtx.rotate(-Math.PI / 2);
    curveCtx.textAlign    = 'center';
    curveCtx.textBaseline = 'top';
    curveCtx.fillText('Output logical pressure', 0, 0);
    curveCtx.restore();
  }

  curveCtx.lineWidth = 2;
  curveCtx.lineJoin  = 'round';

  if (params.curveType === 'null') {
    // Null curve: single straight diagonal from (0,0) to (1,1) — no control nodes
    curveCtx.strokeStyle = CURVE_COLOR;
    curveCtx.beginPath();
    curveCtx.moveTo(PAD_LEFT,         PAD_TOP + plotH);
    curveCtx.lineTo(PAD_LEFT + plotW, PAD_TOP);
    curveCtx.stroke();
  } else if (params.curveType === 'flat') {
    // Flat curve: single horizontal line at flatLevel — no control nodes
    const fy = PAD_TOP + plotH - params.flatLevel * plotH;
    curveCtx.strokeStyle = CURVE_COLOR;
    curveCtx.beginPath();
    curveCtx.moveTo(PAD_LEFT,         fy);
    curveCtx.lineTo(PAD_LEFT + plotW, fy);
    curveCtx.stroke();
  } else {
    // Pressure curve — three segments:
    //   1. Inbound:  x=[0, inputMinimum]           y=outputMinimum  (flat)
    //   2. Middle:   x=[inputMinimum, inputMaximum]                 (shaped by CurveAmount)
    //   3. Outbound: x=[inputMaximum, 1]           y=outputMaximum  (flat)
    const inMin  = params.inputMinimum,  inMax  = params.inputMaximum;
    const outMin = params.minimum,       outMax = params.maximum;

    // Inbound segment
    curveCtx.strokeStyle = CURVE_COLOR;
    curveCtx.beginPath();
    curveCtx.moveTo(PAD_LEFT,                 PAD_TOP + plotH - outMin * plotH);
    curveCtx.lineTo(PAD_LEFT + inMin * plotW, PAD_TOP + plotH - outMin * plotH);
    curveCtx.stroke();

    // Middle segment
    curveCtx.strokeStyle = CURVE_COLOR;
    curveCtx.beginPath();
    const pxStart = Math.round(inMin * plotW);
    const pxEnd   = Math.round(inMax * plotW);
    let first = true;
    for (let px = pxStart; px <= pxEnd; px++) {
      const x  = px / plotW;
      const y  = applyPressureCurve(x);
      const cx = PAD_LEFT + px;
      const cy = PAD_TOP  + plotH - y * plotH;
      if (first) { curveCtx.moveTo(cx, cy); first = false; }
      else          curveCtx.lineTo(cx, cy);
    }
    curveCtx.stroke();

    // Outbound segment
    curveCtx.strokeStyle = CURVE_COLOR;
    curveCtx.beginPath();
    curveCtx.moveTo(PAD_LEFT + inMax * plotW, PAD_TOP + plotH - outMax * plotH);
    curveCtx.lineTo(PAD_LEFT + plotW,         PAD_TOP + plotH - outMax * plotH);
    curveCtx.stroke();

    // Control nodes (minimum and maximum)
    const nodes = [
      { key: 'a', nx: PAD_LEFT + params.inputMinimum * plotW, ny: PAD_TOP + plotH - params.minimum * plotH, color: MIN_CONTROL_NODE_COLOR, guide: MIN_CONTROL_NODE_GUIDE },
      { key: 'b', nx: PAD_LEFT + params.inputMaximum * plotW, ny: PAD_TOP + plotH - params.maximum * plotH, color: MAX_CONTROL_NODE_COLOR, guide: MAX_CONTROL_NODE_GUIDE },
    ];
    for (const { nx, ny, color, guide } of nodes) {
      if (!showNodes) continue;

      // Guide lines: down to x-axis, left to y-axis
      if (showNodeGuides) {
        curveCtx.strokeStyle = guide;
        curveCtx.lineWidth   = 1;
        curveCtx.setLineDash([3, 4]);
        curveCtx.beginPath();
        curveCtx.moveTo(nx, ny);
        curveCtx.lineTo(nx, PAD_TOP + plotH); // vertical down
        curveCtx.moveTo(nx, ny);
        curveCtx.lineTo(PAD_LEFT, ny);        // horizontal left
        curveCtx.stroke();
        curveCtx.setLineDash([]);
      }

      // Node circle
      curveCtx.fillStyle = color;
      curveCtx.beginPath();
      curveCtx.arc(nx, ny, 6, 0, Math.PI * 2);
      curveCtx.fill();
      curveCtx.strokeStyle = '#ffffff';
      curveCtx.lineWidth   = 1.5;
      curveCtx.stroke();
    }
  }

  // Live pressure indicator dot + crosshair guide lines
  if (livePressure !== null) {
    const mapped = applyPressureCurve(livePressure);
    const dotX   = PAD_LEFT + livePressure * plotW;
    const dotY   = PAD_TOP  + plotH - mapped * plotH;

    curveCtx.strokeStyle = 'rgba(200, 50, 80, 0.2)';
    curveCtx.lineWidth   = 1;
    curveCtx.setLineDash([3, 4]);
    curveCtx.beginPath();
    curveCtx.moveTo(dotX, PAD_TOP + plotH);
    curveCtx.lineTo(dotX, dotY);
    curveCtx.moveTo(PAD_LEFT, dotY);
    curveCtx.lineTo(dotX, dotY);
    curveCtx.stroke();
    curveCtx.setLineDash([]);

    curveCtx.fillStyle = '#cc3355';
    curveCtx.beginPath();
    curveCtx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    curveCtx.fill();
  }
}


// ── Node drag interaction ─────────────────────────────────────

const NODE_RADIUS = 8;   // hit-test radius in CSS px
let draggingNode = null; // 'a' | 'b' | null

function curveLayout() {
  const W     = curveCanvas.width  / DPR;
  const H     = curveCanvas.height / DPR;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP  - PAD_BOTTOM;
  return { plotW, plotH };
}

function nodeCenter(key) {
  const { plotW, plotH } = curveLayout();
  if (key === 'a') return {
    x: PAD_LEFT + params.inputMinimum * plotW,
    y: PAD_TOP  + plotH - params.minimum * plotH,
  };
  return {
    x: PAD_LEFT + params.inputMaximum * plotW,
    y: PAD_TOP  + plotH - params.maximum * plotH,
  };
}

function hitTestCurveNode(cssX, cssY) {
  for (const key of ['a', 'b']) {
    const c  = nodeCenter(key);
    const dx = cssX - c.x;
    const dy = cssY - c.y;
    if (Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS) return key;
  }
  return null;
}

function valueFromCurveY(cssY) {
  const { plotH } = curveLayout();
  return Math.min(1, Math.max(0, (PAD_TOP + plotH - cssY) / plotH));
}

function valueFromCurveX(cssX) {
  const { plotW } = curveLayout();
  return Math.min(1, Math.max(0, (cssX - PAD_LEFT) / plotW));
}

curveCanvas.addEventListener('pointerdown', (e) => {
  if (params.curveType === 'null' || params.curveType === 'flat') return;  // no nodes
  const rect = curveCanvas.getBoundingClientRect();
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;
  const hit  = hitTestCurveNode(cssX, cssY);
  if (!hit) return;
  draggingNode = hit;
  curveCanvas.setPointerCapture(e.pointerId);
  e.stopPropagation();
});

curveCanvas.addEventListener('pointermove', (e) => {
  const rect = curveCanvas.getBoundingClientRect();
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;

  if (draggingNode) {
    let inVal  = Math.round(valueFromCurveX(cssX) * 100) / 100;
    let outVal = Math.round(valueFromCurveY(cssY) * 100) / 100;

    if (draggingNode === 'a') {
      // Minimum control node: clamp so it doesn't cross the maximum control node
      inVal  = Math.min(inVal,  params.inputMaximum - 0.01);
      outVal = Math.min(outVal, params.maximum);
      params.inputMinimum = inVal;
      params.minimum      = outVal;
      sliders.inputMinimum.value        = inVal;
      sliders.minimum.value             = outVal;
      valueEls.inputMinimum.textContent = formatValue(inVal);
      valueEls.minimum.textContent      = formatValue(outVal);
    } else {
      // Maximum control node: clamp so it doesn't cross the minimum control node
      inVal  = Math.max(inVal,  params.inputMinimum + 0.01);
      outVal = Math.max(outVal, params.minimum);
      params.inputMaximum = inVal;
      params.maximum      = outVal;
      sliders.inputMaximum.value        = inVal;
      sliders.maximum.value             = outVal;
      valueEls.inputMaximum.textContent = formatValue(inVal);
      valueEls.maximum.textContent      = formatValue(outVal);
    }

    drawCurveCanvas();
    e.stopPropagation();
  } else {
    // Hover cursor
    curveCanvas.style.cursor = hitTestCurveNode(cssX, cssY) ? 'move' : 'default';
  }
});

curveCanvas.addEventListener('pointerup', (e) => {
  if (draggingNode) {
    draggingNode = null;
    curveCanvas.style.cursor = 'default';
    e.stopPropagation();
  }
});

curveCanvas.addEventListener('pointerleave', () => {
  if (!draggingNode) curveCanvas.style.cursor = 'default';
});
