// ============================================================
// Pressure Curve Explorer
//
// Left panel: interactive pressure curve editor with parameters
//   - CurveAmount  (-0.9–0.9): shape of the curve (concave/convex)
//   - InputMinimum (0–1):      input pressure threshold (Node A X)
//   - InputMaximum (0–1):      input pressure ceiling  (Node B X)
//   - OutputMinimum (0–1):     output floor             (Node A Y)
//   - OutputMaximum (0–1):     output ceiling           (Node B Y)
//
// Right panel: drawing canvas using Pointer Events API.
//   Raw stylus pressure is mapped through the curve before
//   being used to set stroke width.
//
// Curve formula from: https://www.desmos.com/calculator/97s6f0yhlb
// ============================================================


// ── Parameters ───────────────────────────────────────────────

const DEFAULT_PARAMS = {
  softness:     0.0,
  inputMinimum: 0,
  inputMaximum: 1,
  minimum:      0,
  maximum:      1,
};

const params = { ...DEFAULT_PARAMS };


// ── Pressure Curve Math ──────────────────────────────────────
//
// x is remapped from [inputMinimum, inputMaximum] → [0, 1],
// then a power curve is applied:
//   softness >= 0:  exponent = 1 - softness        (0.1 … 1.0, concave)
//   softness <  0:  exponent = 1 / (1 + softness)  (1.0 … 10,  convex)
// Result is mapped to [outputMinimum, outputMaximum].

function applyPressureCurve(x) {
  const { softness, inputMinimum, inputMaximum, minimum, maximum } = params;

  // Remap x from [inputMinimum, inputMaximum] to [0, 1]
  const inRange = inputMaximum - inputMinimum;
  const xNorm   = inRange > 0 ? Math.min(1, Math.max(0, (x - inputMinimum) / inRange)) : 0;

  // Apply softness curve between the two nodes
  // softness >= 0: exponent = 1 - softness  (concave, 1.0 → 0.1)
  // softness <  0: exponent = 1/(1+softness) (convex,  1.0 → 10)
  const exp    = softness >= 0 ? 1 - softness : 1 / (1 + softness);
  const curved = Math.pow(xNorm, exp);

  // Map to output range
  return minimum + curved * (maximum - minimum);
}


// ── Curve Canvas ─────────────────────────────────────────────

const curvePanel  = document.getElementById('curve-panel');
const curveCanvas = document.getElementById('curve-canvas');
const curveCtx    = curveCanvas.getContext('2d');

const DPR        = window.devicePixelRatio || 1;
const PAD_LEFT   = 42;   // room for Y-axis labels
const PAD_BOTTOM = 32;   // room for X-axis labels
const PAD_TOP    = 20;
const PAD_RIGHT  = 20;

const CURVE_COLOR = '#3366ee';   // curve color (all three segments)

// Current raw input pressure for the live indicator dot (null = hidden)
let livePressure = null;

// Whether interior grid lines are drawn
let showGrid = true;

// Whether axis tick labels are drawn
let showLabels = true;

// Resize the curve canvas to fill the panel width
function resizeCurveCanvas() {
  const size = Math.max(160, curvePanel.clientWidth - 24); // 12px padding each side
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

  // Plot border
  curveCtx.strokeStyle = '#c8c8d8';
  curveCtx.lineWidth = 1;
  curveCtx.strokeRect(PAD_LEFT, PAD_TOP, plotW, plotH);

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

  // Pressure curve — three segments:
  //   1. Left flat:    x=[0, inputMinimum]           y=outputMinimum
  //   2. Active curve: x=[inputMinimum, inputMaximum]
  //   3. Right flat:   x=[inputMaximum, 1]           y=outputMaximum
  const inMin  = params.inputMinimum,  inMax  = params.inputMaximum;
  const outMin = params.minimum,       outMax = params.maximum;

  curveCtx.lineWidth = 2;
  curveCtx.lineJoin  = 'round';

  // Segment 1 — left flat
  curveCtx.strokeStyle = CURVE_COLOR;
  curveCtx.beginPath();
  curveCtx.moveTo(PAD_LEFT,                      PAD_TOP + plotH - outMin * plotH);
  curveCtx.lineTo(PAD_LEFT + inMin * plotW,      PAD_TOP + plotH - outMin * plotH);
  curveCtx.stroke();

  // Segment 2 — active curve
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

  // Segment 3 — right flat
  curveCtx.strokeStyle = CURVE_COLOR;
  curveCtx.beginPath();
  curveCtx.moveTo(PAD_LEFT + inMax * plotW,      PAD_TOP + plotH - outMax * plotH);
  curveCtx.lineTo(PAD_LEFT + plotW,              PAD_TOP + plotH - outMax * plotH);
  curveCtx.stroke();

  // Combined nodes: A = (inputMinimum, outputMinimum), B = (inputMaximum, outputMaximum)
  const nodes = [
    { key: 'a', nx: PAD_LEFT + params.inputMinimum * plotW, ny: PAD_TOP + plotH - params.minimum * plotH,      color: '#e06060', guide: 'rgba(220,80,80,0.25)'    },
    { key: 'b', nx: PAD_LEFT + params.inputMaximum * plotW, ny: PAD_TOP + plotH - params.maximum * plotH,      color: '#3377dd', guide: 'rgba(50,100,220,0.25)'    },
  ];
  for (const { nx, ny, color, guide } of nodes) {
    // Guide lines: down to x-axis, left to y-axis
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

    // Node circle
    curveCtx.fillStyle = color;
    curveCtx.beginPath();
    curveCtx.arc(nx, ny, 6, 0, Math.PI * 2);
    curveCtx.fill();
    curveCtx.strokeStyle = '#ffffff';
    curveCtx.lineWidth   = 1.5;
    curveCtx.stroke();
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


// ── Curve-node drag interaction ───────────────────────────────

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
      // Node A: clamp so it doesn't cross Node B
      inVal  = Math.min(inVal,  params.inputMaximum - 0.01);
      outVal = Math.min(outVal, params.maximum);
      params.inputMinimum = inVal;
      params.minimum      = outVal;
      sliders.inputMinimum.value        = inVal;
      sliders.minimum.value             = outVal;
      valueEls.inputMinimum.textContent = formatValue(inVal);
      valueEls.minimum.textContent      = formatValue(outVal);
    } else {
      // Node B: clamp so it doesn't cross Node A
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


// ── Drawing Canvas ────────────────────────────────────────────

const drawCanvas = document.getElementById('draw-canvas');
const toolbar    = document.getElementById('toolbar');
const drawCtx    = drawCanvas.getContext('2d');

const CANVAS_BG      = '#f5f5f0';
const MAX_BRUSH_SIZE = 40;

function resizeDrawCanvas() {
  drawCanvas.width  = drawCanvas.offsetWidth;
  drawCanvas.height = drawCanvas.offsetHeight;
  clearDrawCanvas();
}

function clearDrawCanvas() {
  drawCtx.fillStyle = CANVAS_BG;
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function drawSegment(from, to, size) {
  drawCtx.lineWidth   = size;
  drawCtx.strokeStyle = '#1a1a2e';
  drawCtx.lineCap     = 'round';
  drawCtx.lineJoin    = 'round';
  drawCtx.beginPath();
  drawCtx.moveTo(from.x, from.y);
  drawCtx.lineTo(to.x, to.y);
  drawCtx.stroke();
}


// ── Info display ──────────────────────────────────────────────

const infoEls = {
  type:            document.getElementById('val-type'),
  pressureRaw:     document.getElementById('val-pressure-raw'),
  pressureMapped:  document.getElementById('val-pressure-mapped'),
  tiltX:           document.getElementById('val-tiltX'),
  tiltY:           document.getElementById('val-tiltY'),
  azimuth:         document.getElementById('val-azimuth'),
  altitude:        document.getElementById('val-altitude'),
};

function updateInfo(e) {
  const toDeg = r => (r * 180 / Math.PI).toFixed(1);
  const mapped = applyPressureCurve(e.pressure);
  infoEls.type.textContent           = e.pointerType || '---';
  infoEls.pressureRaw.textContent    = e.pressure.toFixed(3);
  infoEls.pressureMapped.textContent = mapped.toFixed(3);
  infoEls.tiltX.textContent          = e.tiltX.toFixed(1) + '°';
  infoEls.tiltY.textContent          = e.tiltY.toFixed(1) + '°';
  infoEls.azimuth.textContent        = toDeg(e.azimuthAngle) + '°';
  infoEls.altitude.textContent       = toDeg(e.altitudeAngle) + '°';
}


// ── Pointer event state ───────────────────────────────────────

let isDrawing = false;
let lastPos   = null;


// ── Pointer event handlers ────────────────────────────────────

drawCanvas.addEventListener('pointerdown', (e) => {
  isDrawing    = true;
  lastPos      = { x: e.offsetX, y: e.offsetY };
  livePressure = e.pressure;
  updateInfo(e);
  drawCurveCanvas();
});

drawCanvas.addEventListener('pointermove', (e) => {
  livePressure = e.pressure;
  updateInfo(e);
  drawCurveCanvas();

  if (!isDrawing) return;

  const pos    = { x: e.offsetX, y: e.offsetY };
  const mapped = applyPressureCurve(e.pressure);
  const size   = Math.max(1, mapped * MAX_BRUSH_SIZE);

  drawSegment(lastPos, pos, size);
  lastPos = pos;
});

drawCanvas.addEventListener('pointerup', () => {
  isDrawing    = false;
  lastPos      = null;
  livePressure = null;
  drawCurveCanvas();
});

drawCanvas.addEventListener('pointerleave', () => {
  isDrawing    = false;
  lastPos      = null;
  livePressure = null;
  drawCurveCanvas();
});


// ── Controls ──────────────────────────────────────────────────

const sliders = {
  softness:     document.getElementById('slider-softness'),
  inputMinimum: document.getElementById('slider-input-minimum'),
  inputMaximum: document.getElementById('slider-input-maximum'),
  minimum:      document.getElementById('slider-minimum'),
  maximum:      document.getElementById('slider-maximum'),
};

const valueEls = {
  softness:     document.getElementById('val-softness'),
  inputMinimum: document.getElementById('val-input-minimum'),
  inputMaximum: document.getElementById('val-input-maximum'),
  minimum:      document.getElementById('val-minimum'),
  maximum:      document.getElementById('val-maximum'),
};

function formatValue(val) {
  return parseFloat(val).toFixed(2);
}

Object.keys(sliders).forEach(key => {
  sliders[key].addEventListener('input', () => {
    let val = parseFloat(sliders[key].value);

    // Keep each min <= max pair
    if (key === 'inputMinimum' && val > params.inputMaximum - 0.01) {
      val = params.inputMaximum - 0.01;
      sliders.inputMinimum.value = val;
    } else if (key === 'inputMaximum' && val < params.inputMinimum + 0.01) {
      val = params.inputMinimum + 0.01;
      sliders.inputMaximum.value = val;
    } else if (key === 'minimum' && val > params.maximum) {
      val = params.maximum;
      sliders.minimum.value = val;
    } else if (key === 'maximum' && val < params.minimum) {
      val = params.minimum;
      sliders.maximum.value = val;
    }

    params[key] = val;
    valueEls[key].textContent = formatValue(val);
    drawCurveCanvas();
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  Object.assign(params, DEFAULT_PARAMS);
  Object.keys(sliders).forEach(k => {
    sliders[k].value              = DEFAULT_PARAMS[k];
    valueEls[k].textContent       = formatValue(DEFAULT_PARAMS[k]);
  });
  drawCurveCanvas();
});

document.getElementById('btn-clear').addEventListener('click', clearDrawCanvas);

const checkboxActions = {
  'chk-grid':   (v) => { showGrid   = v; },
  'chk-labels': (v) => { showLabels = v; },
};
Object.entries(checkboxActions).forEach(([id, apply]) => {
  document.getElementById(id).addEventListener('change', (e) => {
    apply(e.target.checked);
    drawCurveCanvas();
  });
});

// ── Chart copy / save ─────────────────────────────────────────

function buildChartCanvas(region) {
  if (region === 'full') return curveCanvas;
  // Crop to plot area only
  const plotW = Math.round((curveCanvas.width  / DPR - PAD_LEFT - PAD_RIGHT)  * DPR);
  const plotH = Math.round((curveCanvas.height / DPR - PAD_TOP  - PAD_BOTTOM) * DPR);
  const tmp   = document.createElement('canvas');
  tmp.width   = plotW;
  tmp.height  = plotH;
  tmp.getContext('2d').drawImage(
    curveCanvas,
    PAD_LEFT * DPR, PAD_TOP * DPR, plotW, plotH,
    0, 0, plotW, plotH
  );
  return tmp;
}

function canvasToJpegCanvas(src) {
  const tmp = document.createElement('canvas');
  tmp.width  = src.width;
  tmp.height = src.height;
  const ctx = tmp.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(src, 0, 0);
  return tmp;
}

async function copyChart(region) {
  const src     = buildChartCanvas(region);
  const copyBtn = document.getElementById('btn-copy');
  src.toBlob(async (blob) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      const prev = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = prev; }, 1500);
    } catch (err) {
      console.error('Clipboard write failed:', err);
      copyBtn.textContent = 'Failed';
      setTimeout(() => { copyBtn.textContent = 'Copy ▾'; }, 1500);
    }
  }, 'image/png');
}

function saveChart(region) {
  const src  = canvasToJpegCanvas(buildChartCanvas(region));
  const name = region === 'full' ? 'pressure-curve-full.jpg' : 'pressure-curve-plot.jpg';
  const link = document.createElement('a');
  link.download = name;
  link.href     = src.toDataURL('image/jpeg', 0.95);
  link.click();
}

// Dropdown toggle logic
['copy', 'save'].forEach(id => {
  const btn  = document.getElementById(`btn-${id}`);
  const menu = document.getElementById(`menu-${id}`);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    // close the other menu
    document.querySelectorAll('.dropdown-menu').forEach(m => { if (m !== menu) m.classList.remove('open'); });
  });
  menu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    menu.classList.remove('open');
    const [type, region] = action.split('-');
    if (type === 'copy') copyChart(region === 'full' ? 'full' : 'plot');
    else                 saveChart(region === 'full' ? 'full' : 'plot');
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
});


// ── Keyboard shortcuts ────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    clearDrawCanvas();
  }
});


// ── Init ─────────────────────────────────────────────────────

window.addEventListener('resize', resizeDrawCanvas);
resizeDrawCanvas();
// Note: curve canvas is initialised by its ResizeObserver on first layout
