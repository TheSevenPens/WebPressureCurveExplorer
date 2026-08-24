<script>
  import { onMount } from 'svelte';
  import { applyPressureCurve, normalizeBezierPoints, invertPressureCurve } from './curveMath';
  import { CURVE_TYPE } from './curveTypes';
  import { MIN_APPROACH, HANDLE_MODE, SMOOTHING_ORDER, VIEW_MODE } from './uiConstants';
  import { PAD_LEFT, PAD_TOP, PAD_RIGHT, PAD_BOTTOM } from './canvasConstants';
  import { drawBackground, drawGrid as drawCanvasGrid, drawLabels as drawCanvasLabels, drawIndicator } from './canvasUtils';
  import { drawCurveChart, curveLayout, valueFromCanvasX, valueFromCanvasY, isInsidePlotArea } from './drawPressureCurve';
  import {
    NODE_HIT_RADIUS,
    hitTestBezierPoint, hitTestBezierHandle, isRemovableBezierPoint,
    addBezierPointInWidestGap, removeBezierPointAt, insertBezierPointAt,
    moveBezierHandle, setBezierHandleMode,
  } from './bezierInteraction';
  import { copyPngToClipboard, downloadCanvas, flattenOntoWhite } from './canvasExport';
  import PressureChartFormat from './PressureChartFormat.svelte';
  import PressureCurveControls from './PressureCurveControls.svelte';


  export let params;
  export let livePressure = null;
  export let liveRawPressure = null;
  export let liveOutputPressure = null;
  export let showRawIndicator = true;
  export let showEffectiveIndicator = true;
  export let viewMode = VIEW_MODE.CANVAS;
  export let onViewModeChange = () => {};
  export let defaultParams;

  let showGrid = true;
  let showLabels = true;
  let showNodes = true;
  let showNodeGuides = true;

  let menuCopyOpen = false;
  let menuSaveOpen = false;
  let menuFormatOpen = false;
  let bezierContextMenuOpen = false;
  let bezierContextMenuX = 0;
  let bezierContextMenuY = 0;
  let bezierContextValueX = null;
  let bezierContextValueY = null;
  let bezierContextPointIndex = null;
  let copyButtonLabel = 'Copy ▾';

  let curvePanelEl;
  let curveCanvasEl;
  let curveCtx;
  let resizeObserver;
  let curveDpr = 1;
  let lastCurveSize = 0;
  let lastCurveDpr = 0;
  let draggingNode = null;
  let selectedBezierPoint = null;
  let selectedBezierHandle = null;
  let isReady = false;

  $: curveActive = params.curveType === CURVE_TYPE.BASIC || params.curveType === CURVE_TYPE.EXTENDED || params.curveType === CURVE_TYPE.SIGMOID;
  $: flatActive = params.curveType === CURVE_TYPE.FLAT;
  $: bezierActive = params.curveType === CURVE_TYPE.BEZIER;
  $: bezierPoints = normalizeBezierPoints(params.bezierPoints);
  $: canAddBezierPoint = bezierActive && bezierPoints.length < 16;
  $: canRemoveBezierPoint = bezierActive && bezierPoints.length > 2;

  $: if (isReady) {
    params;
    livePressure;
    liveRawPressure;
    liveOutputPressure;
    showGrid;
    showLabels;
    showNodes;
    showNodeGuides;
    showRawIndicator;
    showEffectiveIndicator;
    drawCurveCanvas();
  }

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }

  /**
   * Bezier points read straight from params rather than the `bezierPoints`
   * reactive value, which can lag when several pointer events are handled in
   * the same tick. Mutating from a stale copy silently discards the previous
   * edit.
   */
  function currentBezierPoints() {
    return normalizeBezierPoints(params.bezierPoints);
  }

  function updateBezierPoints(nextPoints) {
    // Normalizing here as well as in the bezierInteraction helpers: the anchor
    // drag below builds its points inline, and normalization is idempotent.
    patchParams({ bezierPoints: normalizeBezierPoints(nextPoints) });
  }

  function addBezierPoint() {
    if (!canAddBezierPoint) return;
    const { points, index } = addBezierPointInWidestGap(currentBezierPoints());
    updateBezierPoints(points);
    selectedBezierPoint = index;
  }

  function removeBezierPoint() {
    if (!canRemoveBezierPoint) return;

    // Fall back to the last interior point when nothing removable is selected.
    const removeIndex = isRemovableBezierPoint(currentBezierPoints(), selectedBezierPoint)
      ? selectedBezierPoint
      : bezierPoints.length - 2;

    updateBezierPoints(removeBezierPointAt(currentBezierPoints(), removeIndex));
    selectedBezierPoint = null;
    selectedBezierHandle = null;
  }

  /** Plot geometry for the live canvas; shared with the drawing module so hit
      testing and rendering cannot disagree about where the plot area is. */
  function currentLayout() {
    return curveLayout(curveCanvasEl.width / curveDpr, curveCanvasEl.height / curveDpr);
  }

  function nodeCenter(key) {
    const { plotW, plotH } = currentLayout();
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
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_HIT_RADIUS) return key;
    }
    return null;
  }

  function valueFromCurveX(cssX) {
    return valueFromCanvasX(cssX, currentLayout().plotW);
  }

  function valueFromCurveY(cssY) {
    return valueFromCanvasY(cssY, currentLayout().plotH);
  }

  function insertBezierPointAtPosition(cssX, cssY) {
    const layout = currentLayout();
    if (!canAddBezierPoint || !isInsidePlotArea(cssX, cssY, layout.plotW, layout.plotH)) return null;

    const result = insertBezierPointAt(currentBezierPoints(), cssX, cssY, layout);
    if (!result) return null;

    updateBezierPoints(result.points);
    selectedBezierPoint = result.index;
    return result.index;
  }

  function openBezierContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!bezierActive) {
      closeMenus();
      return;
    }

    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const hitIndex = hitTestBezierPoint(currentBezierPoints(), cssX, cssY, currentLayout());
    const insidePlot = isInsidePlotArea(cssX, cssY);
    const canAddAtLocation = canAddBezierPoint && insidePlot;
    const canRemoveAtPoint = isRemovableBezierPoint(bezierPoints, hitIndex);

    if (!canAddAtLocation && !canRemoveAtPoint) {
      closeMenus();
      return;
    }

    bezierContextMenuOpen = true;
    bezierContextMenuX = event.clientX;
    bezierContextMenuY = event.clientY;
    bezierContextValueX = canAddAtLocation ? valueFromCurveX(cssX) : null;
    bezierContextValueY = canAddAtLocation ? valueFromCurveY(cssY) : null;
    bezierContextPointIndex = hitIndex;
    if (hitIndex !== null) {
      selectedBezierPoint = hitIndex;
    }
    menuCopyOpen = false;
    menuSaveOpen = false;
  }

  function addBezierPointFromContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (bezierContextValueX === null || bezierContextValueY === null) {
      closeMenus();
      return;
    }

    const { plotW, plotH } = currentLayout();
    const cssX = PAD_LEFT + bezierContextValueX * plotW;
    const cssY = PAD_TOP + plotH - bezierContextValueY * plotH;
    const insertedIndex = insertBezierPointAtPosition(cssX, cssY);
    if (insertedIndex !== null) {
      selectedBezierPoint = insertedIndex;
    }

    closeMenus();
  }

  function removeBezierPointFromContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isRemovableBezierPoint(bezierPoints, bezierContextPointIndex)) {
      closeMenus();
      return;
    }

    selectedBezierPoint = bezierContextPointIndex;
    removeBezierPoint();
    closeMenus();
  }

  function setBezierPointHandleModeFromContextMenu(mode, event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isRemovableBezierPoint(bezierPoints, bezierContextPointIndex)) {
      closeMenus();
      return;
    }

    updateBezierPoints(setBezierHandleMode(currentBezierPoints(), bezierContextPointIndex, mode));
    closeMenus();
  }

  function resizeCurveCanvas() {
    if (!curveCanvasEl || !curvePanelEl || !curveCtx) return;

    // While the panel is collapsed it has no layout box; skip so the cached
    // size survives and expanding restores the chart without a re-fit.
    if (curvePanelEl.clientWidth === 0) return;

    const size = Math.max(160, curvePanelEl.clientWidth - 24);
    curveDpr = window.devicePixelRatio || 1;

    if (size === lastCurveSize && curveDpr === lastCurveDpr && curveCanvasEl.width > 0) {
      drawCurveCanvas();
      return;
    }

    lastCurveSize = size;
    lastCurveDpr = curveDpr;
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

    const { width, height, plotW, plotH } = curveLayout(
      curveCanvasEl.width / curveDpr,
      curveCanvasEl.height / curveDpr,
    );

    drawCurveChart(curveCtx, {
      width,
      height,
      plotW,
      plotH,
      params,
      bezierPoints,
      showGrid,
      showLabels,
      showNodes,
      showNodeGuides,
      showRawIndicator,
      showEffectiveIndicator,
      selectedBezierPoint,
      selectedBezierHandle,
      livePressure,
      liveRawPressure,
      liveOutputPressure,
    });
  }

  function onCurvePointerDown(event) {
    if (event.button === 2) return;
    bezierContextMenuOpen = false;

    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    if (bezierActive) {
      const hitHandle = hitTestBezierHandle(currentBezierPoints(), cssX, cssY, currentLayout());
      if (hitHandle) {
        selectedBezierPoint = hitHandle.index;
        selectedBezierHandle = hitHandle.handle;
        draggingNode = { type: 'bezier-handle', index: hitHandle.index, handle: hitHandle.handle };
        if (curveCanvasEl?.setPointerCapture) {
          curveCanvasEl.setPointerCapture(event.pointerId);
        }
        return;
      }

      const hitIndex = hitTestBezierPoint(currentBezierPoints(), cssX, cssY, currentLayout());
      if (hitIndex === null) {
        selectedBezierPoint = null;
        selectedBezierHandle = null;
        return;
      }
      selectedBezierPoint = hitIndex;
      selectedBezierHandle = null;
      draggingNode = { type: 'bezier-anchor', index: hitIndex };
      if (curveCanvasEl?.setPointerCapture) {
        curveCanvasEl.setPointerCapture(event.pointerId);
      }
      return;
    }

    if (!curveActive || params.curveType === CURVE_TYPE.BASIC) return;
    const hit = hitTestCurveNode(cssX, cssY);
    if (!hit) return;

    draggingNode = { type: 'standard', key: hit };
    if (curveCanvasEl?.setPointerCapture) {
      curveCanvasEl.setPointerCapture(event.pointerId);
    }
  }

  function onCurvePointerMove(event) {
    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    if (draggingNode?.type === 'bezier-anchor') {
      const pointIndex = draggingNode.index;
      if (pointIndex === null || pointIndex >= bezierPoints.length) return;

      const next = [...bezierPoints];
      const point = next[pointIndex];
      const prevX = pointIndex > 0 ? next[pointIndex - 1].x : 0;
      const nextX = pointIndex < next.length - 1 ? next[pointIndex + 1].x : 1;

      let inVal = Math.round(valueFromCurveX(cssX) * 100) / 100;
      const outVal = Math.round(valueFromCurveY(cssY) * 100) / 100;

      if (pointIndex === 0) {
        inVal = 0;
      } else if (pointIndex === next.length - 1) {
        inVal = 1;
      } else {
        inVal = Math.max(prevX + 0.01, Math.min(nextX - 0.01, inVal));
      }

      const dx = inVal - point.x;
      const dy = outVal - point.y;

      next[pointIndex] = {
        ...point,
        x: inVal,
        y: outVal,
        inX: point.inX + dx,
        inY: point.inY + dy,
        outX: point.outX + dx,
        outY: point.outY + dy,
      };

      updateBezierPoints(next);
      drawCurveCanvas();
      return;
    }

    if (draggingNode?.type === 'bezier-handle') {
      const pointIndex = draggingNode.index;
      if (pointIndex === null || pointIndex >= bezierPoints.length) return;

      updateBezierPoints(moveBezierHandle(
        currentBezierPoints(), pointIndex, draggingNode.handle, cssX, cssY, currentLayout(),
      ));
      drawCurveCanvas();
      return;
    }

    if (draggingNode?.type === 'standard') {
      let inVal = Math.round(valueFromCurveX(cssX) * 100) / 100;
      let outVal = Math.round(valueFromCurveY(cssY) * 100) / 100;

      if (draggingNode.key === 'a') {
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

    if (bezierActive) {
      if (hitTestBezierHandle(currentBezierPoints(), cssX, cssY, currentLayout())) {
        curveCanvasEl.style.cursor = 'crosshair';
      } else if (hitTestBezierPoint(currentBezierPoints(), cssX, cssY, currentLayout()) !== null) {
        curveCanvasEl.style.cursor = 'move';
      } else {
        curveCanvasEl.style.cursor = 'default';
      }
    } else {
      curveCanvasEl.style.cursor = params.curveType !== CURVE_TYPE.BASIC && hitTestCurveNode(cssX, cssY) ? 'move' : 'default';
    }
  }

  function onCurvePointerUp(event) {
    if (!draggingNode) return;
    if (curveCanvasEl?.releasePointerCapture && event?.pointerId !== undefined) {
      try {
        curveCanvasEl.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release errors from already-released pointers.
      }
    }
    draggingNode = null;
    curveCanvasEl.style.cursor = 'default';
  }

  function onCurvePointerLeave(event) {
    if (draggingNode) {
      onCurvePointerUp(event);
      return;
    }

    if (!draggingNode) {
      curveCanvasEl.style.cursor = 'default';
    }
  }

  function toggleCopyMenu(event) {
    event.stopPropagation();
    menuCopyOpen = !menuCopyOpen;
    menuSaveOpen = false;
    menuFormatOpen = false;
    bezierContextMenuOpen = false;
  }

  function toggleSaveMenu(event) {
    event.stopPropagation();
    menuSaveOpen = !menuSaveOpen;
    menuCopyOpen = false;
    menuFormatOpen = false;
    bezierContextMenuOpen = false;
  }

  function toggleFormatMenu(event) {
    event.stopPropagation();
    menuFormatOpen = !menuFormatOpen;
    menuCopyOpen = false;
    menuSaveOpen = false;
    bezierContextMenuOpen = false;
  }

  function closeMenus() {
    menuCopyOpen = false;
    menuSaveOpen = false;
    menuFormatOpen = false;
    bezierContextMenuOpen = false;
    bezierContextValueX = null;
    bezierContextValueY = null;
    bezierContextPointIndex = null;
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

  async function copyChart(region) {
    const ok = await copyPngToClipboard(flattenOntoWhite(buildChartCanvas(region)));
    copyButtonLabel = ok ? 'Copied!' : 'Failed';
    setTimeout(() => {
      copyButtonLabel = 'Copy ▾';
    }, 1500);
  }

  function saveChart(region) {
    const baseName = region === 'full' ? 'pressure-curve-full' : 'pressure-curve-plot';
    downloadCanvas(flattenOntoWhite(buildChartCanvas(region)), baseName, 'image/png');
  }

  function handleCopyAction(region) {
    closeMenus();
    copyChart(region);
  }

  function handleSaveAction(region) {
    closeMenus();
    saveChart(region);
  }

  // Outside clicks already dismiss; Escape is the other expected way out,
  // and matters more now that a panel can hold focus.
  function onMenuKeyDown(event) {
    if (event.key === 'Escape') closeMenus();
  }

  onMount(() => {
    curveCtx = curveCanvasEl.getContext('2d');
    resizeCurveCanvas();

    resizeObserver = new ResizeObserver(resizeCurveCanvas);
    resizeObserver.observe(curvePanelEl);

    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', onMenuKeyDown);
    isReady = true;

    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener('click', closeMenus);
      document.removeEventListener('keydown', onMenuKeyDown);
    };
  });
</script>

<div id="curve-panel">
  <div id="panel-left" bind:this={curvePanelEl}>
    <div class="panel-title">Pressure explorer</div>

    <!-- Primary navigation for the whole app, so it leads the column rather
         than sitting among the view's own controls. -->
    <div class="mode-switch" role="group" aria-label="View mode">
      <button
        type="button"
        class="mode-btn"
        class:active={viewMode === VIEW_MODE.CANVAS}
        aria-pressed={viewMode === VIEW_MODE.CANVAS}
        on:click={() => onViewModeChange(VIEW_MODE.CANVAS)}
      >Canvas</button>
      <button
        type="button"
        class="mode-btn"
        class:active={viewMode === VIEW_MODE.RESPONSE}
        aria-pressed={viewMode === VIEW_MODE.RESPONSE}
        on:click={() => onViewModeChange(VIEW_MODE.RESPONSE)}
      >Pressure Response</button>
    </div>
    <canvas
      id="curve-canvas"
      bind:this={curveCanvasEl}
      on:pointerdown={onCurvePointerDown}
      on:pointermove={onCurvePointerMove}
      on:pointerup={onCurvePointerUp}
      on:pointerleave={onCurvePointerLeave}
      on:contextmenu={openBezierContextMenu}
    ></canvas>

    {#if bezierContextMenuOpen}
      <div
        class="canvas-context-menu"
        style={`left: ${bezierContextMenuX}px; top: ${bezierContextMenuY}px;`}
      >
        {#if isRemovableBezierPoint(bezierPoints, bezierContextPointIndex)}
          <button
            type="button"
            disabled={bezierPoints[bezierContextPointIndex].handleMode === HANDLE_MODE.MIRRORED}
            on:click={(event) => setBezierPointHandleModeFromContextMenu(HANDLE_MODE.MIRRORED, event)}
          >
            Handle mode: mirrored
          </button>
          <button
            type="button"
            disabled={bezierPoints[bezierContextPointIndex].handleMode === HANDLE_MODE.BROKEN}
            on:click={(event) => setBezierPointHandleModeFromContextMenu(HANDLE_MODE.BROKEN, event)}
          >
            Handle mode: broken
          </button>
          <button
            type="button"
            on:click={removeBezierPointFromContextMenu}
          >
            Remove point
          </button>
        {/if}
        {#if bezierContextValueX !== null && bezierContextValueY !== null}
          <button
            type="button"
            disabled={!canAddBezierPoint}
            on:click={addBezierPointFromContextMenu}
          >
            Add point here
          </button>
        {/if}
      </div>
    {/if}

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

      <div class="dropdown-wrap">
        <button
          class="action-btn"
          aria-expanded={menuFormatOpen}
          on:click={toggleFormatMenu}
        >Chart Format ▾</button>
        <!-- A popover rather than a menu: it holds checkboxes, not commands,
             so it carries no menu role and swallows clicks to stay open while
             several options are toggled. -->
        <!-- The handler only stops the document listener from closing the
             panel; the div is not a control, so a keyboard equivalent would
             have nothing to do. The checkboxes inside are focusable. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="dropdown-panel" class:open={menuFormatOpen} on:click|stopPropagation>
          <PressureChartFormat
            bind:showGrid
            bind:showLabels
            bind:showNodes
            bind:showNodeGuides
            bind:showRawIndicator
            bind:showEffectiveIndicator
            {curveActive}
            onToggle={drawCurveCanvas}
          />
        </div>
      </div>
    </div>

  </div>

  <PressureCurveControls
    bind:params
    {defaultParams}
    {curveActive}
    {flatActive}
    {bezierActive}
    {canAddBezierPoint}
    {canRemoveBezierPoint}
    onAddBezierPoint={addBezierPoint}
    onRemoveBezierPoint={removeBezierPoint}
  />
</div>
