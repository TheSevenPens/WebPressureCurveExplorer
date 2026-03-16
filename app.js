// ============================================================
// Pressure Curve Explorer
//
// Left panel: interactive pressure curve editor with parameters
//   - Gain      (1–5):      amplify/shift the input range
//   - Softness  (-0.9–0.9): shape of the curve (concave/convex)
//   - Minimum   (0–100):    output floor as a percentage
//   - Maximum   (0–100):    output ceiling as a percentage
//   - Invert    (bool):     flip the curve
//
// Right panel: drawing canvas using Pointer Events API.
//   Raw stylus pressure is mapped through the curve before
//   being used to set stroke width.
//
// Curve formula from: https://www.desmos.com/calculator/97s6f0yhlb
// ============================================================


// ── Parameters ───────────────────────────────────────────────

const DEFAULT_PARAMS = {
  gain:     1.0,
  softness: 0.0,
  minimum:  0,
  maximum:  1,
};

const params = { ...DEFAULT_PARAMS };


// ── Pressure Curve Math ──────────────────────────────────────
//
// For softness >= 0:  exponent = 1 - softness        (0.1 … 1.0, concave)
// For softness <  0:  exponent = 1 / (1 + softness)  (1.0 … 10, convex)
//
// base = x * gain   (may exceed 1; gets clamped by min/max)
//
// y = sign * base^exponent + offset
//   where sign = invert ? -1 : 1
//         offset = invert ? 1 : 0
//
// then clamped to [minimum/100, maximum/100]

function applyPressureCurve(x) {
  const { gain, softness, minimum, maximum } = params;

  if (x <= 0) return minimum;

  const exponent = softness >= 0
    ? (1 - softness)
    : (1 / (1 + softness));

  const y = Math.pow(x * gain, exponent);
  return Math.min(Math.max(minimum, y), maximum);
}


// ── Curve Canvas ─────────────────────────────────────────────

const curvePanel  = document.getElementById('curve-panel');
const curveCanvas = document.getElementById('curve-canvas');
const curveCtx    = curveCanvas.getContext('2d');

const DPR        = window.devicePixelRatio || 1;
const PAD_LEFT   = 30;   // room for Y-axis labels
const PAD_BOTTOM = 20;   // room for X-axis labels
const PAD_TOP    = 8;
const PAD_RIGHT  = 8;

// Current raw input pressure for the live indicator dot (null = hidden)
let livePressure = null;

// Resize the curve canvas to fill the panel width (keeping it square)
function resizeCurveCanvas() {
  const size = Math.max(160, curvePanel.clientWidth - 24); // 12px padding each side
  curveCanvas.style.width  = size + 'px';
  curveCanvas.style.height = size + 'px';
  curveCanvas.width        = Math.round(size * DPR);
  curveCanvas.height       = Math.round(size * DPR);
  curveCtx.scale(DPR, DPR); // reset after canvas resize
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

  // Grid lines
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

  // Plot border
  curveCtx.strokeStyle = '#c8c8d8';
  curveCtx.lineWidth = 1;
  curveCtx.strokeRect(PAD_LEFT, PAD_TOP, plotW, plotH);

  // Axis tick labels
  curveCtx.fillStyle = '#9999aa';
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

  // Axis labels
  curveCtx.fillStyle    = '#aaaabc';
  curveCtx.font         = '9px Segoe UI, sans-serif';
  curveCtx.textAlign    = 'center';
  curveCtx.textBaseline = 'bottom';
  curveCtx.fillText('Input Pressure', PAD_LEFT + plotW / 2, H - 1);

  // Diagonal reference (linear / identity)
  curveCtx.strokeStyle = '#dcdce8';
  curveCtx.lineWidth   = 1;
  curveCtx.beginPath();
  curveCtx.moveTo(PAD_LEFT,          PAD_TOP + plotH);
  curveCtx.lineTo(PAD_LEFT + plotW,  PAD_TOP);
  curveCtx.stroke();

  // The pressure curve
  curveCtx.strokeStyle = '#3366ee';
  curveCtx.lineWidth   = 2;
  curveCtx.lineJoin    = 'round';
  curveCtx.beginPath();
  let firstPoint = true;
  for (let px = 0; px <= plotW; px++) {
    const x  = px / plotW;
    const y  = applyPressureCurve(x);
    const cx = PAD_LEFT + px;
    const cy = PAD_TOP  + plotH - y * plotH;
    if (firstPoint) { curveCtx.moveTo(cx, cy); firstPoint = false; }
    else              curveCtx.lineTo(cx, cy);
  }
  curveCtx.stroke();

  // Live pressure indicator dot + crosshair guide lines
  if (livePressure !== null) {
    const mapped = applyPressureCurve(livePressure);
    const dotX   = PAD_LEFT + Math.min(livePressure, 1) * plotW;
    const dotY   = PAD_TOP  + plotH - Math.min(mapped, 1) * plotH;

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
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  drawCtx.lineWidth   = size;
  drawCtx.strokeStyle = '#1a1a2e';
  drawCtx.lineCap     = 'round';
  drawCtx.lineJoin    = 'round';
  drawCtx.beginPath();
  drawCtx.moveTo(from.x, from.y);
  drawCtx.quadraticCurveTo(from.x, from.y, mid.x, mid.y);
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
  gain:     document.getElementById('slider-gain'),
  softness: document.getElementById('slider-softness'),
  minimum:  document.getElementById('slider-minimum'),
  maximum:  document.getElementById('slider-maximum'),
};

const valueEls = {
  gain:     document.getElementById('val-gain'),
  softness: document.getElementById('val-softness'),
  minimum:  document.getElementById('val-minimum'),
  maximum:  document.getElementById('val-maximum'),
};

function formatValue(key, val) {
  if (key === 'gain')     return parseFloat(val).toFixed(1);
  if (key === 'softness') return parseFloat(val).toFixed(2);
  if (key === 'minimum')  return parseFloat(val).toFixed(2);
  if (key === 'maximum')  return parseFloat(val).toFixed(2);
  return String(val);
}

Object.keys(sliders).forEach(key => {
  sliders[key].addEventListener('input', () => {
    let val = parseFloat(sliders[key].value);

    // Keep minimum <= maximum
    if (key === 'minimum' && val > params.maximum) {
      val = params.maximum;
      sliders.minimum.value = val;
    } else if (key === 'maximum' && val < params.minimum) {
      val = params.minimum;
      sliders.maximum.value = val;
    }

    params[key] = val;
    valueEls[key].textContent = formatValue(key, val);
    drawCurveCanvas();
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  Object.assign(params, DEFAULT_PARAMS);
  sliders.gain.value     = DEFAULT_PARAMS.gain;
  sliders.softness.value = DEFAULT_PARAMS.softness;
  sliders.minimum.value  = DEFAULT_PARAMS.minimum;
  sliders.maximum.value  = DEFAULT_PARAMS.maximum;
  Object.keys(valueEls).forEach(k => {
    valueEls[k].textContent = formatValue(k, DEFAULT_PARAMS[k]);
  });
  drawCurveCanvas();
});

document.getElementById('btn-clear').addEventListener('click', clearDrawCanvas);


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
