<script>
  import { onMount } from 'svelte';
  import { applyPressureCurve } from './curveMath';
  import PressureChartFormat from './PressureChartFormat.svelte';
  import PressureChartControls from './PressureChartControls.svelte';

  const PAD_LEFT = 42;
  const PAD_BOTTOM = 32;
  const PAD_TOP = 20;
  const PAD_RIGHT = 20;
  const X_LABEL_SPACING = 8;
  const Y_LABEL_SPACING = 8;

  const CURVE_COLOR = '#000000';
  const MIN_CONTROL_NODE_COLOR = 'rgb(255, 0, 136)';
  const MIN_CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';
  const MAX_CONTROL_NODE_COLOR = '#00d0ff';
  const MAX_CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';

  const NODE_RADIUS = 8;

  export let params;
  export let livePressure = null;
  export let defaultParams;

  let showGrid = true;
  let showLabels = true;
  let showNodes = true;
  let showNodeGuides = true;

  let menuCopyOpen = false;
  let menuSaveOpen = false;
  let copyButtonLabel = 'Copy ▾';

  let curvePanelEl;
  let curveCanvasEl;
  let curveCtx;
  let resizeObserver;
  let curveDpr = 1;
  let lastCurveSize = 0;
  let draggingNode = null;
  let isReady = false;

  $: curveActive = params.curveType !== 'null-effect' && params.curveType !== 'flat';
  $: flatActive = params.curveType === 'flat';

  $: if (isReady) {
    params;
    livePressure;
    showGrid;
    showLabels;
    showNodes;
    showNodeGuides;
    drawCurveCanvas();
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
      for (let i = 0; i <= 4; i += 1) {
        const gx = PAD_LEFT + (i / 4) * plotW;
        const gy = PAD_TOP + (i / 4) * plotH;

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
      for (let i = 0; i <= 4; i += 1) {
        const gx = PAD_LEFT + (i / 4) * plotW;
        curveCtx.fillText((i * 0.25).toFixed(2), gx, PAD_TOP + plotH + X_LABEL_SPACING);
      }

      curveCtx.textAlign = 'right';
      curveCtx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i += 1) {
        const gy = PAD_TOP + plotH - (i / 4) * plotH;
        curveCtx.fillText((i * 0.25).toFixed(2), PAD_LEFT - Y_LABEL_SPACING, gy);
      }

      curveCtx.fillStyle = '#000000';
      curveCtx.font = '9px Segoe UI, sans-serif';
      curveCtx.textAlign = 'center';
      curveCtx.textBaseline = 'bottom';
      curveCtx.fillText('INPUT', PAD_LEFT + plotW / 2, height - 1);

      curveCtx.save();
      curveCtx.translate(9, PAD_TOP + plotH / 2);
      curveCtx.rotate(-Math.PI / 2);
      curveCtx.textAlign = 'center';
      curveCtx.textBaseline = 'top';
      curveCtx.fillText('OUTPUT', 0, 0);
      curveCtx.restore();
    }

    curveCtx.lineWidth = 2;
    curveCtx.lineJoin = 'round';

    if (params.curveType === 'null-effect') {
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

  onMount(() => {
    curveCtx = curveCanvasEl.getContext('2d');
    resizeCurveCanvas();

    resizeObserver = new ResizeObserver(resizeCurveCanvas);
    resizeObserver.observe(curvePanelEl);

    document.addEventListener('click', closeMenus);
    isReady = true;

    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener('click', closeMenus);
    };
  });
</script>

<div id="curve-panel">
  <div id="panel-left" bind:this={curvePanelEl}>
    <div class="panel-title">Pressure explorer</div>
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

    <PressureChartFormat
      bind:showGrid
      bind:showLabels
      bind:showNodes
      bind:showNodeGuides
      {curveActive}
      onToggle={drawCurveCanvas}
    />
  </div>

  <PressureChartControls bind:params {defaultParams} {curveActive} {flatActive} />
</div>
