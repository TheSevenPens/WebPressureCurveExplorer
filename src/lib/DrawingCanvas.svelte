<script>
  import { onMount } from 'svelte';
  import { applyPressureCurve } from './curveMath';

  const MAX_BRUSH_SIZE = 40;
  const CANVAS_BG = '#f5f5f0';
  const MAX_DPR = 2;
  const MAX_DEVICE_DIMENSION = 4096;

  const initialInfo = {
    type: '---',
    pressureRaw: '---',
    pressureMapped: '---',
    tiltX: '---',
    tiltY: '---',
    azimuth: '---',
    altitude: '---',
  };

  export let params;
  export let livePressure = null;

  let info = { ...initialInfo };

  let drawPanelEl;
  let toolbarEl;
  let drawCanvasEl;
  let drawCtx;
  let drawDpr = 1;
  let resizeObserver;
  let resizeRafId = 0;
  let lastDeviceWidth = 0;
  let lastDeviceHeight = 0;
  let isDrawing = false;
  let lastPos = null;

  function pointerToCanvasPos(pointerEvent) {
    const rect = drawCanvasEl.getBoundingClientRect();
    return {
      x: pointerEvent.clientX - rect.left,
      y: pointerEvent.clientY - rect.top,
    };
  }

  function scheduleResize() {
    if (resizeRafId) return;
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = 0;
      resizeDrawCanvas();
    });
  }

  function resizeDrawCanvas() {
    if (!drawCanvasEl || !drawCtx || !drawPanelEl || !toolbarEl) return;

    // Read the final CSS layout size of the canvas to avoid width drift.
    const rect = drawCanvasEl.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));

    drawDpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);

    const nextDeviceWidth = Math.max(1, Math.min(MAX_DEVICE_DIMENSION, Math.round(cssWidth * drawDpr)));
    const nextDeviceHeight = Math.max(1, Math.min(MAX_DEVICE_DIMENSION, Math.round(cssHeight * drawDpr)));

    // Avoid resetting backing store when size did not actually change.
    if (nextDeviceWidth === lastDeviceWidth && nextDeviceHeight === lastDeviceHeight) {
      return;
    }

    lastDeviceWidth = nextDeviceWidth;
    lastDeviceHeight = nextDeviceHeight;

    drawCanvasEl.width = nextDeviceWidth;
    drawCanvasEl.height = nextDeviceHeight;

    drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    drawCtx.scale(drawDpr, drawDpr);
    clearDrawCanvas();
  }

  function clearDrawCanvas() {
    if (!drawCanvasEl || !drawCtx) return;
    const cssWidth = Math.max(1, drawCanvasEl.width / drawDpr);
    const cssHeight = Math.max(1, drawCanvasEl.height / drawDpr);
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
    lastPos = pointerToCanvasPos(event);
    livePressure = Number(event.pressure ?? 0);
    updateInfo(event);

    if (drawCanvasEl?.setPointerCapture) {
      drawCanvasEl.setPointerCapture(event.pointerId);
    }
  }

  function onDrawPointerMove(event) {
    livePressure = Number(event.pressure ?? 0);
    updateInfo(event);

    if (!isDrawing) return;

    const currentPos = pointerToCanvasPos(event);
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
  }

  function onKeyDown(event) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      clearDrawCanvas();
    }
  }

  onMount(() => {
    drawCtx = drawCanvasEl.getContext('2d');
    scheduleResize();

    resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(drawPanelEl);

    window.addEventListener('resize', scheduleResize);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      if (resizeRafId) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      document.removeEventListener('keydown', onKeyDown);
    };
  });
</script>

<div id="draw-panel" bind:this={drawPanelEl}>
  <div id="toolbar" bind:this={toolbarEl}>
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
