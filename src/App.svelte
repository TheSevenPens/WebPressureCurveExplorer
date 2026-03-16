<script>
  import { onMount } from 'svelte';
  import { applyPressureCurve } from './lib/curveMath';

  const DEFAULT_PARAMS = {
    softness: 0.0,
    inputMinimum: 0,
    inputMaximum: 1,
    minimum: 0,
    maximum: 1,
    curveType: 'power',
    transitionWidth: 0,
    flatLevel: 0.5,
  };

  const PAD_LEFT = 42;
  const PAD_BOTTOM = 32;
  const PAD_TOP = 20;
  const PAD_RIGHT = 20;

  const CURVE_COLOR = '#000000';
  const MIN_CONTROL_NODE_COLOR = 'rgb(255, 0, 136)';
  const MIN_CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';
  const MAX_CONTROL_NODE_COLOR = '#00d0ff';
  const MAX_CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';

  const NODE_RADIUS = 8;
  const MAX_BRUSH_SIZE = 40;
  const CANVAS_BG = '#f5f5f0';

  const initialInfo = {
    type: '---',
    pressureRaw: '---',
    pressureMapped: '---',
    tiltX: '---',
    tiltY: '---',
    azimuth: '---',
    altitude: '---',
  };

  let params = { ...DEFAULT_PARAMS };
  let info = { ...initialInfo };

  let showGrid = true;
  let showLabels = true;
  let showNodes = true;
  let showNodeGuides = true;

  let livePressure = null;
  let lastCurveSize = 0;
  let curveDpr = 1;
  let drawDpr = 1;

  let menuCopyOpen = false;
  let menuSaveOpen = false;
  let copyButtonLabel = 'Copy ▾';

  let curvePanelEl;
  let curveCanvasEl;
  let drawCanvasEl;

  let curveCtx;
  let drawCtx;
  let resizeObserver;

  let draggingNode = null;
  let isDrawing = false;
  let lastPos = null;

  $: curveActive = params.curveType !== 'null' && params.curveType !== 'flat';
  $: flatActive = params.curveType === 'flat';

  function formatValue(value) {
    return Number(value).toFixed(2);
  }

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }

  function curveLayout() {
    const width = curveCanvasEl.width / curveDpr;
    const height = curveCanvasEl.height / curveDpr;
    return {
      plotW: width - PAD_LEFT - PAD_RIGHT,
      plotH: height - PAD_TOP - PAD_BOTTOM,
    };
  }

  function nodeCenter(key) {
    const { plotW, plotH } = curveLayout();
    if (key === 'a') {
      return {
        x: PAD_LEFT + params.inputMinimum * plotW,
        y: PAD_TOP + plotH - params.minimum * plotH,
      };
    }
    return {
      x: PAD_LEFT + params.inputMaximum * plotW,
      y: PAD_TOP + plotH - params.maximum * plotH,
    };
  }

  function hitTestCurveNode(cssX, cssY) {
    for (const key of ['a', 'b']) {
      const center = nodeCenter(key);
      const dx = cssX - center.x;
      const dy = cssY - center.y;
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS) return key;
    }
    return null;
  }

  function valueFromCurveX(cssX) {
    const { plotW } = curveLayout();
    return Math.min(1, Math.max(0, (cssX - PAD_LEFT) / plotW));
  }

  function valueFromCurveY(cssY) {
    const { plotH } = curveLayout();
    return Math.min(1, Math.max(0, (PAD_TOP + plotH - cssY) / plotH));
  }

  function resizeCurveCanvas() {
    if (!curveCanvasEl || !curvePanelEl || !curveCtx) return;

    const size = Math.max(160, curvePanelEl.clientWidth - 24);
    curveDpr = window.devicePixelRatio || 1;

    if (size === lastCurveSize && curveCanvasEl.width > 0) {
      drawCurveCanvas();
      return;
    }

    lastCurveSize = size;
    curveCanvasEl.style.width = `${size}px`;
    curveCanvasEl.style.height = `${size}px`;
    curveCanvasEl.width = Math.round(size * curveDpr);
    curveCanvasEl.height = Math.round(size * curveDpr);

    curveCtx.setTransform(1, 0, 0, 1, 0, 0);
    curveCtx.scale(curveDpr, curveDpr);
    drawCurveCanvas();
  }

  function drawCurveCanvas() {
    if (!curveCanvasEl || !curveCtx || curveCanvasEl.width === 0) return;

    const width = curveCanvasEl.width / curveDpr;
    const height = curveCanvasEl.height / curveDpr;
    const plotW = width - PAD_LEFT - PAD_RIGHT;
    const plotH = height - PAD_TOP - PAD_BOTTOM;

    curveCtx.fillStyle = '#ffffff';
    curveCtx.fillRect(0, 0, width, height);
    curveCtx.fillStyle = '#f7f7fb';
    curveCtx.fillRect(PAD_LEFT, PAD_TOP, plotW, plotH);

    if (showGrid) {
      curveCtx.strokeStyle = '#ebebf4';
      curveCtx.lineWidth = 1;
      for (let i = 0; i <= 5; i += 1) {
        const gx = PAD_LEFT + (i / 5) * plotW;
        const gy = PAD_TOP + (i / 5) * plotH;

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

    if (showLabels) {
      curveCtx.fillStyle = '#000000';
      curveCtx.font = '9px Consolas, monospace';

      curveCtx.textAlign = 'center';
      curveCtx.textBaseline = 'top';
      for (let i = 0; i <= 5; i += 1) {
        const gx = PAD_LEFT + (i / 5) * plotW;
        curveCtx.fillText((i * 0.2).toFixed(1), gx, PAD_TOP + plotH + 4);
      }

      curveCtx.textAlign = 'right';
      curveCtx.textBaseline = 'middle';
      for (let i = 0; i <= 5; i += 1) {
        const gy = PAD_TOP + plotH - (i / 5) * plotH;
        curveCtx.fillText((i * 0.2).toFixed(1), PAD_LEFT - 4, gy);
      }

      curveCtx.fillStyle = '#000000';
      curveCtx.font = '9px Segoe UI, sans-serif';
      curveCtx.textAlign = 'center';
      curveCtx.textBaseline = 'bottom';
      curveCtx.fillText('Input logical pressure', PAD_LEFT + plotW / 2, height - 1);

      curveCtx.save();
      curveCtx.translate(9, PAD_TOP + plotH / 2);
      curveCtx.rotate(-Math.PI / 2);
      curveCtx.textAlign = 'center';
      curveCtx.textBaseline = 'top';
      curveCtx.fillText('Output logical pressure', 0, 0);
      curveCtx.restore();
    }

    curveCtx.lineWidth = 2;
    curveCtx.lineJoin = 'round';

    if (params.curveType === 'null') {
      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT, PAD_TOP + plotH);
      curveCtx.lineTo(PAD_LEFT + plotW, PAD_TOP);
      curveCtx.stroke();
    } else if (params.curveType === 'flat') {
      const fy = PAD_TOP + plotH - params.flatLevel * plotH;
      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT, fy);
      curveCtx.lineTo(PAD_LEFT + plotW, fy);
      curveCtx.stroke();
    } else {
      const inMin = params.inputMinimum;
      const inMax = params.inputMaximum;
      const outMin = params.minimum;
      const outMax = params.maximum;

      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT, PAD_TOP + plotH - outMin * plotH);
      curveCtx.lineTo(PAD_LEFT + inMin * plotW, PAD_TOP + plotH - outMin * plotH);
      curveCtx.stroke();

      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      const pxStart = Math.round(inMin * plotW);
      const pxEnd = Math.round(inMax * plotW);
      let first = true;
      for (let px = pxStart; px <= pxEnd; px += 1) {
        const x = px / plotW;
        const y = applyPressureCurve(x, params);
        const cx = PAD_LEFT + px;
        const cy = PAD_TOP + plotH - y * plotH;
        if (first) {
          curveCtx.moveTo(cx, cy);
          first = false;
        } else {
          curveCtx.lineTo(cx, cy);
        }
      }
      curveCtx.stroke();

      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT + inMax * plotW, PAD_TOP + plotH - outMax * plotH);
      curveCtx.lineTo(PAD_LEFT + plotW, PAD_TOP + plotH - outMax * plotH);
      curveCtx.stroke();

      const nodes = [
        {
          x: PAD_LEFT + params.inputMinimum * plotW,
          y: PAD_TOP + plotH - params.minimum * plotH,
          color: MIN_CONTROL_NODE_COLOR,
          guide: MIN_CONTROL_NODE_GUIDE,
        },
        {
          x: PAD_LEFT + params.inputMaximum * plotW,
          y: PAD_TOP + plotH - params.maximum * plotH,
          color: MAX_CONTROL_NODE_COLOR,
          guide: MAX_CONTROL_NODE_GUIDE,
        },
      ];

      for (const node of nodes) {
        if (!showNodes) continue;

        if (showNodeGuides) {
          curveCtx.strokeStyle = node.guide;
          curveCtx.lineWidth = 1;
          curveCtx.setLineDash([3, 4]);
          curveCtx.beginPath();
          curveCtx.moveTo(node.x, node.y);
          curveCtx.lineTo(node.x, PAD_TOP + plotH);
          curveCtx.moveTo(node.x, node.y);
          curveCtx.lineTo(PAD_LEFT, node.y);
          curveCtx.stroke();
          curveCtx.setLineDash([]);
        }

        curveCtx.fillStyle = node.color;
        curveCtx.beginPath();
        curveCtx.arc(node.x, node.y, 6, 0, Math.PI * 2);
        curveCtx.fill();

        curveCtx.strokeStyle = '#ffffff';
        curveCtx.lineWidth = 1.5;
        curveCtx.stroke();
      }
    }

    if (livePressure !== null) {
      const mapped = applyPressureCurve(livePressure, params);
      const dotX = PAD_LEFT + livePressure * plotW;
      const dotY = PAD_TOP + plotH - mapped * plotH;

      curveCtx.strokeStyle = 'rgba(200, 50, 80, 0.2)';
      curveCtx.lineWidth = 1;
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

  function resizeDrawCanvas() {
    if (!drawCanvasEl || !drawCtx) return;

    const cssWidth = drawCanvasEl.offsetWidth;
    const cssHeight = drawCanvasEl.offsetHeight;
    drawDpr = window.devicePixelRatio || 1;

    drawCanvasEl.width = Math.round(cssWidth * drawDpr);
    drawCanvasEl.height = Math.round(cssHeight * drawDpr);

    drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    drawCtx.scale(drawDpr, drawDpr);
    clearDrawCanvas();
  }

  function clearDrawCanvas() {
    if (!drawCanvasEl || !drawCtx) return;
    const cssWidth = drawCanvasEl.width / drawDpr;
    const cssHeight = drawCanvasEl.height / drawDpr;
    drawCtx.fillStyle = CANVAS_BG;
    drawCtx.fillRect(0, 0, cssWidth, cssHeight);
  }

  function drawSegment(from, to, size) {
    drawCtx.lineWidth = size;
    drawCtx.strokeStyle = '#1a1a2e';
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.beginPath();
    drawCtx.moveTo(from.x, from.y);
    drawCtx.lineTo(to.x, to.y);
    drawCtx.stroke();
  }

  function updateInfo(pointerEvent) {
    const toDegrees = (radians) => (radians * 180 / Math.PI).toFixed(1);
    const pressure = Number(pointerEvent.pressure ?? 0);
    const mapped = applyPressureCurve(pressure, params);

    info = {
      type: pointerEvent.pointerType || '---',
      pressureRaw: pressure.toFixed(3),
      pressureMapped: mapped.toFixed(3),
      tiltX: `${Number(pointerEvent.tiltX ?? 0).toFixed(1)}°`,
      tiltY: `${Number(pointerEvent.tiltY ?? 0).toFixed(1)}°`,
      azimuth: `${toDegrees(Number(pointerEvent.azimuthAngle ?? 0))}°`,
      altitude: `${toDegrees(Number(pointerEvent.altitudeAngle ?? 0))}°`,
    };
  }

  function resetInfo() {
    info = { ...initialInfo };
  }

  function onDrawPointerDown(event) {
    isDrawing = true;
    lastPos = { x: event.offsetX, y: event.offsetY };
    livePressure = Number(event.pressure ?? 0);
    updateInfo(event);
    drawCurveCanvas();

    if (drawCanvasEl?.setPointerCapture) {
      drawCanvasEl.setPointerCapture(event.pointerId);
    }
  }

  function onDrawPointerMove(event) {
    livePressure = Number(event.pressure ?? 0);
    updateInfo(event);
    drawCurveCanvas();

    if (!isDrawing) return;

    const currentPos = { x: event.offsetX, y: event.offsetY };
    const mapped = applyPressureCurve(livePressure, params);
    const size = Math.max(1, mapped * MAX_BRUSH_SIZE);
    drawSegment(lastPos, currentPos, size);
    lastPos = currentPos;
  }

  function stopDrawing() {
    isDrawing = false;
    lastPos = null;
    livePressure = null;
    resetInfo();
    drawCurveCanvas();
  }

  function onCurvePointerDown(event) {
    if (!curveActive) return;

    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const hit = hitTestCurveNode(cssX, cssY);
    if (!hit) return;

    draggingNode = hit;
    if (curveCanvasEl?.setPointerCapture) {
      curveCanvasEl.setPointerCapture(event.pointerId);
    }
  }

  function onCurvePointerMove(event) {
    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    if (draggingNode) {
      let inVal = Math.round(valueFromCurveX(cssX) * 100) / 100;
      let outVal = Math.round(valueFromCurveY(cssY) * 100) / 100;

      if (draggingNode === 'a') {
        inVal = Math.min(inVal, params.inputMaximum - 0.01);
        outVal = Math.min(outVal, params.maximum);
        patchParams({
          inputMinimum: inVal,
          minimum: outVal,
        });
      } else {
        inVal = Math.max(inVal, params.inputMinimum + 0.01);
        outVal = Math.max(outVal, params.minimum);
        patchParams({
          inputMaximum: inVal,
          maximum: outVal,
        });
      }

      drawCurveCanvas();
      return;
    }

    curveCanvasEl.style.cursor = hitTestCurveNode(cssX, cssY) ? 'move' : 'default';
  }

  function onCurvePointerUp() {
    if (!draggingNode) return;
    draggingNode = null;
    curveCanvasEl.style.cursor = 'default';
  }

  function onCurvePointerLeave() {
    if (!draggingNode) {
      curveCanvasEl.style.cursor = 'default';
    }
  }

  function handleSliderInput(key, event) {
    let value = parseFloat(event.currentTarget.value);

    if (key === 'inputMinimum' && value > params.inputMaximum - 0.01) {
      value = params.inputMaximum - 0.01;
      event.currentTarget.value = String(value);
    } else if (key === 'inputMaximum' && value < params.inputMinimum + 0.01) {
      value = params.inputMinimum + 0.01;
      event.currentTarget.value = String(value);
    } else if (key === 'minimum' && value > params.maximum) {
      value = params.maximum;
      event.currentTarget.value = String(value);
    } else if (key === 'maximum' && value < params.minimum) {
      value = params.minimum;
      event.currentTarget.value = String(value);
    }

    patchParams({ [key]: value });
    drawCurveCanvas();
  }

  function handleCurveTypeChange(event) {
    patchParams({ curveType: event.currentTarget.value });
    drawCurveCanvas();
  }

  function resetToDefaults() {
    params = { ...DEFAULT_PARAMS };
    drawCurveCanvas();
  }

  function toggleCopyMenu(event) {
    event.stopPropagation();
    menuCopyOpen = !menuCopyOpen;
    menuSaveOpen = false;
  }

  function toggleSaveMenu(event) {
    event.stopPropagation();
    menuSaveOpen = !menuSaveOpen;
    menuCopyOpen = false;
  }

  function closeMenus() {
    menuCopyOpen = false;
    menuSaveOpen = false;
  }

  function buildChartCanvas(region) {
    if (region === 'full') {
      return curveCanvasEl;
    }

    const plotW = Math.round((curveCanvasEl.width / curveDpr - PAD_LEFT - PAD_RIGHT) * curveDpr);
    const plotH = Math.round((curveCanvasEl.height / curveDpr - PAD_TOP - PAD_BOTTOM) * curveDpr);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = plotW;
    tempCanvas.height = plotH;

    const tempContext = tempCanvas.getContext('2d');
    tempContext.drawImage(
      curveCanvasEl,
      PAD_LEFT * curveDpr,
      PAD_TOP * curveDpr,
      plotW,
      plotH,
      0,
      0,
      plotW,
      plotH,
    );

    return tempCanvas;
  }

  function canvasToJpegCanvas(sourceCanvas) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceCanvas.width;
    tempCanvas.height = sourceCanvas.height;

    const tempContext = tempCanvas.getContext('2d');
    tempContext.fillStyle = '#ffffff';
    tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempContext.drawImage(sourceCanvas, 0, 0);

    return tempCanvas;
  }

  async function copyChart(region) {
    const sourceCanvas = buildChartCanvas(region);

    sourceCanvas.toBlob(async (blob) => {
      if (!blob) return;

      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        const previousLabel = copyButtonLabel;
        copyButtonLabel = 'Copied!';
        setTimeout(() => {
          copyButtonLabel = previousLabel;
        }, 1500);
      } catch (error) {
        console.error('Clipboard write failed:', error);
        copyButtonLabel = 'Failed';
        setTimeout(() => {
          copyButtonLabel = 'Copy ▾';
        }, 1500);
      }
    }, 'image/png');
  }

  function saveChart(region) {
    const sourceCanvas = canvasToJpegCanvas(buildChartCanvas(region));
    const fileName = region === 'full' ? 'pressure-curve-full.jpg' : 'pressure-curve-plot.jpg';

    const link = document.createElement('a');
    link.download = fileName;
    link.href = sourceCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }

  function handleCopyAction(region) {
    closeMenus();
    copyChart(region);
  }

  function handleSaveAction(region) {
    closeMenus();
    saveChart(region);
  }

  function onKeyDown(event) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      clearDrawCanvas();
    }
  }

  function preventContextMenu(event) {
    event.preventDefault();
  }

  onMount(() => {
    curveCtx = curveCanvasEl.getContext('2d');
    drawCtx = drawCanvasEl.getContext('2d');

    resizeCurveCanvas();
    resizeDrawCanvas();

    resizeObserver = new ResizeObserver(resizeCurveCanvas);
    resizeObserver.observe(curvePanelEl);

    window.addEventListener('resize', resizeDrawCanvas);
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeDrawCanvas);
      document.removeEventListener('click', closeMenus);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  });
</script>

<div id="app">
  <div id="curve-panel">
    <div id="panel-left" bind:this={curvePanelEl}>
      <div class="panel-title">Pressure curve explorer</div>
      <canvas
        id="curve-canvas"
        bind:this={curveCanvasEl}
        on:pointerdown={onCurvePointerDown}
        on:pointermove={onCurvePointerMove}
        on:pointerup={onCurvePointerUp}
        on:pointerleave={onCurvePointerLeave}
      ></canvas>

      <div id="chart-actions">
        <div class="dropdown-wrap">
          <button class="action-btn" on:click={toggleCopyMenu}>{copyButtonLabel}</button>
          <div class="dropdown-menu" class:open={menuCopyOpen}>
            <button on:click={() => handleCopyAction('full')}>Full chart</button>
            <button on:click={() => handleCopyAction('plot')}>Plot area only</button>
          </div>
        </div>

        <div class="dropdown-wrap">
          <button class="action-btn" on:click={toggleSaveMenu}>Save ▾</button>
          <div class="dropdown-menu" class:open={menuSaveOpen}>
            <button on:click={() => handleSaveAction('full')}>Full chart</button>
            <button on:click={() => handleSaveAction('plot')}>Plot area only</button>
          </div>
        </div>
      </div>

      <label class="checkbox-row">
        <input type="checkbox" checked={showGrid} on:change={(e) => { showGrid = e.currentTarget.checked; drawCurveCanvas(); }}>
        <span class="param-name">Show Grid</span>
      </label>

      <label class="checkbox-row">
        <input type="checkbox" checked={showLabels} on:change={(e) => { showLabels = e.currentTarget.checked; drawCurveCanvas(); }}>
        <span class="param-name">Show Labels</span>
      </label>

      <label class="checkbox-row" class:disabled={!curveActive}>
        <input type="checkbox" checked={showNodes} disabled={!curveActive} on:change={(e) => { showNodes = e.currentTarget.checked; drawCurveCanvas(); }}>
        <span class="param-name">Show Nodes</span>
      </label>

      <label class="checkbox-row" class:disabled={!curveActive}>
        <input type="checkbox" checked={showNodeGuides} disabled={!curveActive} on:change={(e) => { showNodeGuides = e.currentTarget.checked; drawCurveCanvas(); }}>
        <span class="param-name">Show Node Guides</span>
      </label>
    </div>

    <div id="panel-right">
      <div id="controls">
        <div class="param">
          <div class="param-header">
            <span class="param-name">CurveType</span>
          </div>
          <select value={params.curveType} on:change={handleCurveTypeChange}>
            <option value="null">Null</option>
            <option value="flat">Flat</option>
            <option value="power">Power</option>
            <option value="sigmoid">Sigmoid</option>
          </select>
        </div>

        <div class="param" class:disabled={!flatActive}>
          <div class="param-header">
            <span class="param-name">FlatLevel</span>
            <span class="param-value">{formatValue(params.flatLevel)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.flatLevel}
            disabled={!flatActive}
            on:input={(e) => handleSliderInput('flatLevel', e)}
          >
        </div>

        <div class="param" class:disabled={!curveActive}>
          <div class="param-header">
            <span class="param-name">CurveAmount</span>
            <span class="param-value">{formatValue(params.softness)}</span>
          </div>
          <input
            type="range"
            min="-0.9"
            max="0.9"
            step="0.01"
            value={params.softness}
            disabled={!curveActive}
            on:input={(e) => handleSliderInput('softness', e)}
          >
        </div>

        <div class="param" style="display:none">
          <div class="param-header">
            <span class="param-name">Transition</span>
            <span class="param-value">{formatValue(params.transitionWidth)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={params.transitionWidth}
            disabled={!curveActive}
            on:input={(e) => handleSliderInput('transitionWidth', e)}
          >
        </div>

        <div class="param" class:disabled={!curveActive}>
          <div class="param-header">
            <span class="param-name">InputMinimum</span>
            <span class="param-value">{formatValue(params.inputMinimum)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.inputMinimum}
            disabled={!curveActive}
            on:input={(e) => handleSliderInput('inputMinimum', e)}
          >
        </div>

        <div class="param" class:disabled={!curveActive}>
          <div class="param-header">
            <span class="param-name">InputMaximum</span>
            <span class="param-value">{formatValue(params.inputMaximum)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.inputMaximum}
            disabled={!curveActive}
            on:input={(e) => handleSliderInput('inputMaximum', e)}
          >
        </div>

        <div class="param" class:disabled={!curveActive}>
          <div class="param-header">
            <span class="param-name">OutputMinimum</span>
            <span class="param-value">{formatValue(params.minimum)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.minimum}
            disabled={!curveActive}
            on:input={(e) => handleSliderInput('minimum', e)}
          >
        </div>

        <div class="param" class:disabled={!curveActive}>
          <div class="param-header">
            <span class="param-name">OutputMaximum</span>
            <span class="param-value">{formatValue(params.maximum)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.maximum}
            disabled={!curveActive}
            on:input={(e) => handleSliderInput('maximum', e)}
          >
        </div>

        <button id="btn-reset" on:click={resetToDefaults}>Reset to Defaults</button>
      </div>
    </div>
  </div>

  <div id="draw-panel">
    <div id="toolbar">
      <button id="btn-clear" on:click={clearDrawCanvas}>Clear</button>
      <span class="info-item">Type: <span class="val">{info.type}</span></span>
      <span class="info-item">
        Pressure: <span class="val">{info.pressureRaw}</span>
        <span class="arrow">→</span>
        <span class="val mapped">{info.pressureMapped}</span>
      </span>
      <span class="info-item">Tilt X: <span class="val">{info.tiltX}</span></span>
      <span class="info-item">Tilt Y: <span class="val">{info.tiltY}</span></span>
      <span class="info-item">Azimuth: <span class="val">{info.azimuth}</span></span>
      <span class="info-item">Altitude: <span class="val">{info.altitude}</span></span>
    </div>

    <canvas
      id="draw-canvas"
      bind:this={drawCanvasEl}
      on:pointerdown={onDrawPointerDown}
      on:pointermove={onDrawPointerMove}
      on:pointerup={stopDrawing}
      on:pointerleave={stopDrawing}
    ></canvas>
  </div>
</div>
