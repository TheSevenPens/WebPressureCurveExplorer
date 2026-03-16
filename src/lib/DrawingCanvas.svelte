<script>
  import { onMount } from 'svelte';
  import { applyPressureCurve } from './curveMath';
  import DrawingCanvasHeader from './DrawingCanvasHeader.svelte';

  const MAX_BRUSH_SIZE = 40;
  const CANVAS_BG = '#f5f5f0';

  const initialInfo = {
    type: '---',
    pressureRaw: '---',
    pressureSmoothed: '---',
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
  let resizeObserver;
  let resizeRafId = 0;
  let lastDeviceWidth = 0;
  let lastDeviceHeight = 0;
  let isDrawing = false;
  let lastPos = null;
  let smoothedPressure = null;

  function getSmoothedPressure(rawPressure) {
    const smoothing = Math.min(0.99, Math.max(0, Number(params.emaSmoothing ?? 0)));

    if (smoothing <= 0) {
      smoothedPressure = rawPressure;
      return rawPressure;
    }

    if (smoothedPressure === null) {
      smoothedPressure = rawPressure;
      return rawPressure;
    }

    const alpha = 1 - smoothing;
    smoothedPressure = smoothedPressure + alpha * (rawPressure - smoothedPressure);
    return smoothedPressure;
  }

  function pointerToCanvasPos(pointerEvent) {
    const rect = drawCanvasEl.getBoundingClientRect();
    const scaleX = rect.width > 0 ? drawCanvasEl.width / rect.width : 1;
    const scaleY = rect.height > 0 ? drawCanvasEl.height / rect.height : 1;
    return {
      x: (pointerEvent.clientX - rect.left) * scaleX,
      y: (pointerEvent.clientY - rect.top) * scaleY,
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

    // Use container geometry so the canvas always fills the full right panel.
    const cssWidth = Math.max(1, drawPanelEl.clientWidth);
    const cssHeight = Math.max(1, drawPanelEl.clientHeight - toolbarEl.offsetHeight);

    drawCanvasEl.style.width = `${cssWidth}px`;
    drawCanvasEl.style.height = `${cssHeight}px`;

    const nextDeviceWidth = cssWidth;
    const nextDeviceHeight = cssHeight;

    // Avoid resetting backing store when size did not actually change.
    if (nextDeviceWidth === lastDeviceWidth && nextDeviceHeight === lastDeviceHeight) {
      return;
    }

    lastDeviceWidth = nextDeviceWidth;
    lastDeviceHeight = nextDeviceHeight;

    drawCanvasEl.width = nextDeviceWidth;
    drawCanvasEl.height = nextDeviceHeight;

    drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    clearDrawCanvas();
  }

  function clearDrawCanvas() {
    if (!drawCanvasEl || !drawCtx) return;
    const cssWidth = Math.max(1, drawCanvasEl.width);
    const cssHeight = Math.max(1, drawCanvasEl.height);
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

  function updateInfo(pointerEvent, rawPressure, filteredPressure) {
    const toDegrees = (radians) => (radians * 180 / Math.PI).toFixed(1);
    const mapped = applyPressureCurve(filteredPressure, params);

    info = {
      type: pointerEvent.pointerType || '---',
      pressureRaw: rawPressure.toFixed(3),
      pressureSmoothed: filteredPressure.toFixed(3),
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
    const rawPressure = Number(event.pressure ?? 0);
    const filteredPressure = getSmoothedPressure(rawPressure);
    livePressure = filteredPressure;
    updateInfo(event, rawPressure, filteredPressure);

    if (drawCanvasEl?.setPointerCapture) {
      drawCanvasEl.setPointerCapture(event.pointerId);
    }
  }

  function onDrawPointerMove(event) {
    const rawPressure = Number(event.pressure ?? 0);
    const filteredPressure = getSmoothedPressure(rawPressure);
    livePressure = filteredPressure;
    updateInfo(event, rawPressure, filteredPressure);

    if (!isDrawing) return;

    const currentPos = pointerToCanvasPos(event);
    const mapped = applyPressureCurve(filteredPressure, params);
    const size = Math.max(1, mapped * MAX_BRUSH_SIZE);
    drawSegment(lastPos, currentPos, size);
    lastPos = currentPos;
  }

  function stopDrawing() {
    isDrawing = false;
    lastPos = null;
    smoothedPressure = null;
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
  <DrawingCanvasHeader bind:el={toolbarEl} {info} onClear={clearDrawCanvas} />

  <canvas
    id="draw-canvas"
    bind:this={drawCanvasEl}
    on:pointerdown={onDrawPointerDown}
    on:pointermove={onDrawPointerMove}
    on:pointerup={stopDrawing}
    on:pointerleave={stopDrawing}
  ></canvas>
</div>
