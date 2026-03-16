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
  maximum:  100,
  invert:   false,
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
  const { gain, softness, minimum, maximum, invert } = params;
  const minOut = minimum / 100;
  const maxOut = maximum / 100;

  if (x <= 0) return minOut;

  const exponent = softness >= 0
    ? (1 - softness)
    : (1 / (1 + softness));

  const base   = x * gain;
  const sign   = invert ? -1 : 1;
  const offset = invert ? 1  : 0;

  const y = sign * Math.pow(base, exponent) + offset;
  return Math.min(Math.max(minOut, y), maxOut);
}


// ── Curve Canvas ─────────────────────────────────────────────

const curveCanvas = document.getElementById('curve-canvas');
const curveCtx    = curveCanvas.getContext('2d');

const CURVE_SIZE = 240;
const PAD_LEFT   = 30;   // room for Y-axis labels
const PAD_BOTTOM = 20;   // room for X-axis labels
const PAD_TOP    = 8;
const PAD_RIGHT  = 8;

// HiDPI support
const DPR = window.devicePixelRatio || 1;
curveCanvas.width        = CURVE_SIZE * DPR;
curveCanvas.height       = CURVE_SIZE * DPR;
curveCanvas.style.width  = CURVE_SIZE + 'px';
curveCanvas.style.height = CURVE_SIZE + 'px';
curveCtx.scale(DPR, DPR);

const plotW = CURVE_SIZE - PAD_LEFT - PAD_RIGHT;
const plotH = CURVE_SIZE - PAD_TOP  - PAD_BOTTOM;

// Current raw input pressure for the live indicator dot (null = hidden)
let livePressure = null;

function drawCurveCanvas() {
  const W = CURVE_SIZE;
  const H = CURVE_SIZE;

  // Background
  curveCtx.fillStyle = '#13131f';
  curveCtx.fillRect(0, 0, W, H);

  // Grid lines
  curveCtx.strokeStyle = '#1e1e30';
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
  curveCtx.strokeStyle = '#3a3a55';
  curveCtx.lineWidth = 1;
  curveCtx.strokeRect(PAD_LEFT, PAD_TOP, plotW, plotH);

  // Axis tick labels
  curveCtx.fillStyle = '#555570';
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
  curveCtx.fillStyle    = '#44445a';
  curveCtx.font         = '9px Segoe UI, sans-serif';
  curveCtx.textAlign    = 'center';
  curveCtx.textBaseline = 'bottom';
  curveCtx.fillText('Input Pressure', PAD_LEFT + plotW / 2, CURVE_SIZE - 1);

  // Diagonal reference (linear / identity)
  curveCtx.strokeStyle = '#2a2a40';
  curveCtx.lineWidth   = 1;
  curveCtx.beginPath();
  curveCtx.moveTo(PAD_LEFT,          PAD_TOP + plotH);
  curveCtx.lineTo(PAD_LEFT + plotW,  PAD_TOP);
  curveCtx.stroke();

  // The pressure curve
  curveCtx.strokeStyle = '#89b4fa';
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

    curveCtx.strokeStyle = 'rgba(243, 139, 168, 0.3)';
    curveCtx.lineWidth   = 1;
    curveCtx.setLineDash([3, 4]);
    curveCtx.beginPath();
    curveCtx.moveTo(dotX, PAD_TOP + plotH);
    curveCtx.lineTo(dotX, dotY);
    curveCtx.moveTo(PAD_LEFT, dotY);
    curveCtx.lineTo(dotX, dotY);
    curveCtx.stroke();
    curveCtx.setLineDash([]);

    curveCtx.fillStyle = '#f38ba8';
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
  if (key === 'gain')     return val.toFixed(1);
  if (key === 'softness') return parseFloat(val).toFixed(2);
  return Math.round(val).toString();
}

Object.keys(sliders).forEach(key => {
  sliders[key].addEventListener('input', () => {
    const val = parseFloat(sliders[key].value);
    params[key] = val;
    valueEls[key].textContent = formatValue(key, val);
    drawCurveCanvas();
  });
});

document.getElementById('toggle-invert').addEventListener('change', (e) => {
  params.invert = e.target.checked;
  drawCurveCanvas();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  Object.assign(params, DEFAULT_PARAMS);
  sliders.gain.value     = DEFAULT_PARAMS.gain;
  sliders.softness.value = DEFAULT_PARAMS.softness;
  sliders.minimum.value  = DEFAULT_PARAMS.minimum;
  sliders.maximum.value  = DEFAULT_PARAMS.maximum;
  document.getElementById('toggle-invert').checked = DEFAULT_PARAMS.invert;
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
drawCurveCanvas();
