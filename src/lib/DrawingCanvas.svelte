<script>
  import { onMount } from 'svelte';
  import { COLOR_MODE, PRESSURE_CONTROL } from './uiConstants';
  import { timestampedFileName } from './fileNames';
  import { createPressureProcessor, readPointerSample, clearPointerSample, EMPTY_POINTER_INFO } from './pressurePipeline';

  const CANVAS_BG = '#f5f5f0';
  const STROKE_PALETTE = [
    '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
    '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990',
    '#dcbeff', '#9a6324', '#800000', '#aaffc3', '#808000',
    '#000075',
  ];

  export let params;
  export let livePressure = null;
  export let liveRawPressure = null;
  export let liveOutputPressure = null;
  export let info = { ...EMPTY_POINTER_INFO };
  // Brush controls live in the view toolbar above, outside this component.
  export let brushSize = 40;
  export let colorMode = COLOR_MODE.BLACK;
  export let pressureControls = PRESSURE_CONTROL.SIZE;

  const processor = createPressureProcessor();

  let drawPanelEl;
  let processedCanvasEl;
  let rawCanvasEl;
  let processedCtx;
  let rawCtx;
  let resizeObserver;
  let resizeRafId = 0;
  // Exact device-pixel content box per canvas, reported by ResizeObserver.
  const devicePixelBoxes = new WeakMap();
  // Backing size last applied to each canvas, so a change to either one is seen.
  const appliedBacking = new WeakMap();
  let isDrawing = false;
  let lastPos = null;
  let drawZeroPressure = false;
  let strokeColor = '#1a1a2e';
  let lastColorIndex = -1;

  function pickStrokeColor() {
    if (colorMode === COLOR_MODE.BLACK) {
      strokeColor = '#1a1a2e';
      return;
    }
    let index;
    do {
      index = Math.floor(Math.random() * STROKE_PALETTE.length);
    } while (index === lastColorIndex);
    lastColorIndex = index;
    strokeColor = STROKE_PALETTE[index];
  }

  function pointerToCanvasPos(pointerEvent, canvasEl) {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: pointerEvent.clientX - rect.left,
      y: pointerEvent.clientY - rect.top,
    };
  }

  function scheduleResize() {
    if (resizeRafId) return;
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = 0;
      resizeDrawCanvases();
    });
  }

  // Size of the canvas backing store in real screen pixels. ResizeObserver's
  // device-pixel content box is exact; the getBoundingClientRect fallback is
  // for browsers that do not report it.
  function backingSizeFor(canvasEl) {
    const exact = devicePixelBoxes.get(canvasEl);
    if (exact && exact.width > 0 && exact.height > 0) return exact;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvasEl.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width * dpr)),
      height: Math.max(1, Math.round(rect.height * dpr)),
    };
  }

  function resizeDrawCanvases() {
    if (!processedCanvasEl || !processedCtx || !rawCanvasEl || !rawCtx || !drawPanelEl) return;
    // Hidden while the other view is active: keep the current backing store so
    // the strokes survive, exactly as when the left panels are collapsed.
    if (drawPanelEl.clientWidth === 0) return;

    // Draw in CSS pixels while the backing store holds one texel per screen
    // pixel, so strokes are rasterised at full display resolution instead of
    // being upscaled by the compositor.
    //
    // Each canvas is measured and sized from its own box. The two are
    // equal-flex so they normally match, but their device-pixel boxes can
    // still differ by a pixel — flex rounding, or the top label wrapping
    // because of its extra checkbox — and stamping one canvas's size onto the
    // other would leave that one with a non-dpr scale, undoing the HiDPI work.
    for (const [ctx, canvasEl] of [[processedCtx, processedCanvasEl], [rawCtx, rawCanvasEl]]) {
      const { width: backingWidth, height: backingHeight } = backingSizeFor(canvasEl);
      const applied = appliedBacking.get(canvasEl);

      if (applied && applied.width === backingWidth && applied.height === backingHeight) continue;

      appliedBacking.set(canvasEl, { width: backingWidth, height: backingHeight });

      const rect = canvasEl.getBoundingClientRect();
      const previous = snapshotCanvas(canvasEl);

      canvasEl.width = backingWidth;
      canvasEl.height = backingHeight;

      // Setting width/height resets the context, so repaint the background and
      // restore existing strokes at 1:1 before reapplying the scale transform.
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, backingWidth, backingHeight);
      if (previous) ctx.drawImage(previous, 0, 0);

      ctx.setTransform(
        rect.width > 0 ? backingWidth / rect.width : 1, 0,
        0, rect.height > 0 ? backingHeight / rect.height : 1,
        0, 0,
      );
    }
  }

  // Copy of the current backing store, used to carry strokes across a resize.
  function snapshotCanvas(canvasEl) {
    if (canvasEl.width === 0 || canvasEl.height === 0) return null;
    const copy = document.createElement('canvas');
    copy.width = canvasEl.width;
    copy.height = canvasEl.height;
    copy.getContext('2d').drawImage(canvasEl, 0, 0);
    return copy;
  }

  export function clear() {
    clearDrawCanvases();
  }

  function clearDrawCanvases() {
    for (const [ctx, canvasEl] of [[processedCtx, processedCanvasEl], [rawCtx, rawCanvasEl]]) {
      if (!ctx || !canvasEl) continue;
      const transform = ctx.getTransform();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.setTransform(transform);
    }
  }

  function drawSegment(ctx, from, to, size, opacity) {
    ctx.lineWidth = size;
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function handlePointerDown(event, sourceCanvas) {
    pickStrokeColor();
    isDrawing = true;
    lastPos = pointerToCanvasPos(event, sourceCanvas);
    let processedPressure;
    ({ liveRawPressure, livePressure, liveOutputPressure, info, processed: processedPressure } =
      readPointerSample(processor, event, params));

    if (sourceCanvas?.setPointerCapture) {
      sourceCanvas.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event, sourceCanvas) {
    let processedPressure;
    ({ liveRawPressure, livePressure, liveOutputPressure, info, processed: processedPressure } =
      readPointerSample(processor, event, params));

    if (!isDrawing) return;

    const currentPos = pointerToCanvasPos(event, sourceCanvas);

    if (drawZeroPressure || processedPressure.outputPressure > 0) {
      const pSize = pressureControls === PRESSURE_CONTROL.OPACITY ? brushSize : Math.max(1, processedPressure.outputPressure * brushSize);
      const pOpacity = pressureControls === PRESSURE_CONTROL.OPACITY ? Math.max(0.02, processedPressure.outputPressure) : 1;
      drawSegment(processedCtx, lastPos, currentPos, pSize, pOpacity);
    }

    const rSize = pressureControls === PRESSURE_CONTROL.OPACITY ? brushSize : Math.max(1, liveRawPressure * brushSize);
    const rOpacity = pressureControls === PRESSURE_CONTROL.OPACITY ? Math.max(0.02, liveRawPressure) : 1;
    drawSegment(rawCtx, lastPos, currentPos, rSize, rOpacity);

    lastPos = currentPos;
  }

  function stopDrawing() {
    isDrawing = false;
    lastPos = null;
    ({ liveRawPressure, livePressure, liveOutputPressure, info } =
      clearPointerSample(processor));
  }

  async function copyCanvas(canvasEl) {
    canvasEl.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch (error) {
        console.error('Clipboard write failed:', error);
      }
    }, 'image/png');
  }

  function saveCanvas(canvasEl, baseName) {
    const link = document.createElement('a');
    link.download = timestampedFileName(baseName, 'png');
    link.href = canvasEl.toDataURL('image/png');
    link.click();
  }

  function onKeyDown(event) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;

    // Hidden behind the other view: the shortcut would silently wipe a drawing
    // the user cannot even see.
    if (!drawPanelEl || drawPanelEl.clientWidth === 0) return;

    // Backspace belongs to whatever field has focus, such as NamedSlider's
    // click-to-edit value.
    const target = event.target;
    if (target instanceof HTMLElement
      && (target.isContentEditable
        || target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT')) {
      return;
    }

    event.preventDefault();
    clearDrawCanvases();
  }

  onMount(() => {
    processedCtx = processedCanvasEl.getContext('2d');
    rawCtx = rawCanvasEl.getContext('2d');
    scheduleResize();

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.devicePixelContentBoxSize?.[0];
        if (box) {
          devicePixelBoxes.set(entry.target, { width: box.inlineSize, height: box.blockSize });
        }
      }
      scheduleResize();
    });
    resizeObserver.observe(drawPanelEl);
    for (const canvasEl of [processedCanvasEl, rawCanvasEl]) {
      try {
        resizeObserver.observe(canvasEl, { box: 'device-pixel-content-box' });
      } catch {
        resizeObserver.observe(canvasEl);
      }
    }

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
  <div class="split-canvas-wrap">
    <div class="split-canvas-label">
      <span>Pressure processing: ON</span>
      <label class="zero-pressure-toggle">
        <input type="checkbox" bind:checked={drawZeroPressure} />
        Draw at zero effective pressure
      </label>
      <span class="canvas-export-buttons">
        <button type="button" class="canvas-export-btn" on:click={() => copyCanvas(processedCanvasEl)}>Copy</button>
        <button type="button" class="canvas-export-btn" on:click={() => saveCanvas(processedCanvasEl, 'processed')}>Save</button>
      </span>
    </div>
    <canvas
      class="draw-canvas"
      bind:this={processedCanvasEl}
      on:pointerdown={(e) => handlePointerDown(e, processedCanvasEl)}
      on:pointermove={(e) => handlePointerMove(e, processedCanvasEl)}
      on:pointerup={stopDrawing}
      on:pointerleave={stopDrawing}
    ></canvas>

    <div class="split-canvas-divider"></div>

    <div class="split-canvas-label">
      <span>Pressure processing: OFF</span>
      <span class="canvas-export-buttons">
        <button type="button" class="canvas-export-btn" on:click={() => copyCanvas(rawCanvasEl)}>Copy</button>
        <button type="button" class="canvas-export-btn" on:click={() => saveCanvas(rawCanvasEl, 'unprocessed')}>Save</button>
      </span>
    </div>
    <canvas
      class="draw-canvas"
      bind:this={rawCanvasEl}
      on:pointerdown={(e) => handlePointerDown(e, rawCanvasEl)}
      on:pointermove={(e) => handlePointerMove(e, rawCanvasEl)}
      on:pointerup={stopDrawing}
      on:pointerleave={stopDrawing}
    ></canvas>
  </div>
</div>

<style>
  .split-canvas-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
  }

  .split-canvas-label {
    font-size: 12px;
    font-weight: 600;
    color: #333;
    padding: 4px 8px;
    background: #e8e8e2;
    border-bottom: 1px solid #d0d0c8;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .canvas-export-buttons {
    margin-left: auto;
    display: flex;
    gap: 4px;
  }

  .canvas-export-btn {
    font-size: 12px;
    padding: 1px 8px;
    cursor: pointer;
    border: 1px solid #bbb;
    border-radius: 3px;
    background: #f5f5f0;
  }

  .canvas-export-btn:hover {
    background: #ddd;
  }

  .zero-pressure-toggle {
    font-size: 12px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 3px;
    cursor: pointer;
  }

  .draw-canvas {
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    display: block;
    touch-action: none;
    overscroll-behavior: none;
    cursor: crosshair;
  }

  .split-canvas-divider {
    height: 1px;
    background: #ccc;
    flex-shrink: 0;
  }
</style>
