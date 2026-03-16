// ── Controls ──────────────────────────────────────────────────
// Slider/checkbox wiring, curve type selector, copy/save, keyboard,
// and page initialisation.
// Reads everything from the files loaded before it.


// ── Slider input handlers ─────────────────────────────────────

Object.keys(sliders).forEach(key => {
  sliders[key].addEventListener('input', () => {
    let val = parseFloat(sliders[key].value);

    // Keep each min ≤ max pair at least 0.01 apart
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


// ── Control visibility sync ───────────────────────────────────
// Enable/disable controls based on which curve type is active.

// Controls relevant to shaped curves (power / sigmoid)
const CURVE_CONTROL_IDS = [
  'slider-softness', 'slider-transition-width',
  'slider-input-minimum', 'slider-input-maximum',
  'slider-minimum', 'slider-maximum', 'chk-nodes', 'chk-node-guides',
];

// Controls relevant only to the flat curve
const FLAT_CONTROL_IDS = ['slider-flat-level'];

function setControlEnabled(id, enabled) {
  const el = document.getElementById(id);
  el.disabled = !enabled;
  const row = el.closest('.param, .checkbox-row');
  if (row) row.classList.toggle('disabled', !enabled);
}

function syncNullMode() {
  const type = params.curveType;
  const curveActive = (type !== 'null' && type !== 'flat');
  const flatActive  = (type === 'flat');
  CURVE_CONTROL_IDS.forEach(id => setControlEnabled(id, curveActive));
  FLAT_CONTROL_IDS.forEach(id  => setControlEnabled(id, flatActive));
}


// ── Reset ─────────────────────────────────────────────────────

document.getElementById('btn-reset').addEventListener('click', () => {
  Object.assign(params, DEFAULT_PARAMS);
  Object.keys(sliders).forEach(k => {
    sliders[k].value        = DEFAULT_PARAMS[k];
    valueEls[k].textContent = formatValue(DEFAULT_PARAMS[k]);
  });
  document.getElementById('select-curve-type').value = DEFAULT_PARAMS.curveType;
  syncNullMode();
  drawCurveCanvas();
});


// ── Curve type selector ───────────────────────────────────────

document.getElementById('select-curve-type').addEventListener('change', (e) => {
  params.curveType = e.target.value;
  syncNullMode();
  drawCurveCanvas();
});


// ── Misc control wiring ───────────────────────────────────────

document.getElementById('btn-clear').addEventListener('click', clearDrawCanvas);

const checkboxActions = {
  'chk-grid':        (v) => { showGrid       = v; },
  'chk-labels':      (v) => { showLabels     = v; },
  'chk-nodes':       (v) => { showNodes      = v; },
  'chk-node-guides': (v) => { showNodeGuides = v; },
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
    // Close the other menu
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
syncNullMode(); // apply disabled state for initial curveType
