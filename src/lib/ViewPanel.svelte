<script>
  import PenDataToolbar from './PenDataToolbar.svelte';
  import CanvasControls from './CanvasControls.svelte';
  import ResponseControls from './ResponseControls.svelte';
  import DrawingCanvas from './DrawingCanvas.svelte';
  import PressureResponseView from './PressureResponseView.svelte';
  import { COLOR_MODE, PRESSURE_CONTROL, VIEW_MODE } from './uiConstants';
  import { EMPTY_POINTER_INFO } from './pressurePipeline';

  export let params;
  export let livePressure = null;
  export let liveRawPressure = null;
  export let liveOutputPressure = null;
  export let showRawIndicator = true;
  export let showEffectiveIndicator = true;

  export let viewMode = VIEW_MODE.CANVAS;
  export let responseData = null;
  export let showResponseCurveEffect = true;
  export let onResponseDataChange = () => {};
  export let onResponseShowCurveEffectChange = () => {};

  // Pen readouts are shared across views, so the toolbar lives here and each
  // view writes into it.
  let info = { ...EMPTY_POINTER_INFO };

  let brushSize = 40;
  let colorMode = COLOR_MODE.BLACK;
  let pressureControls = PRESSURE_CONTROL.SIZE;
  let drawingCanvas;

  function setMode(mode) {
    if (viewMode === mode) return;
    viewMode = mode;
    // The outgoing view owned the live values; clear them so the indicators do
    // not freeze at whatever the last pointer event left behind.
    info = { ...EMPTY_POINTER_INFO };
    livePressure = null;
    liveRawPressure = null;
    liveOutputPressure = null;
  }
</script>

<div id="view-panel">
  <PenDataToolbar {info} />

  <div class="view-controls-toolbar">
    <div class="mode-switch" role="group" aria-label="View mode">
      <button
        type="button"
        class="mode-btn"
        class:active={viewMode === VIEW_MODE.CANVAS}
        aria-pressed={viewMode === VIEW_MODE.CANVAS}
        on:click={() => setMode(VIEW_MODE.CANVAS)}
      >Canvas</button>
      <button
        type="button"
        class="mode-btn"
        class:active={viewMode === VIEW_MODE.RESPONSE}
        aria-pressed={viewMode === VIEW_MODE.RESPONSE}
        on:click={() => setMode(VIEW_MODE.RESPONSE)}
      >Pressure Response</button>
    </div>


    <span class="toolbar-sep"></span>

    {#if viewMode === VIEW_MODE.CANVAS}
      <CanvasControls
        onClear={() => drawingCanvas?.clear()}
        {brushSize}
        onBrushSizeChange={(v) => brushSize = v}
        {colorMode}
        onColorModeChange={(v) => colorMode = v}
        {pressureControls}
        onPressureControlsChange={(v) => pressureControls = v}
      />
    {:else}
      <ResponseControls
        data={responseData}
        showCurveEffect={showResponseCurveEffect}
        onDataChange={onResponseDataChange}
        onShowCurveEffectChange={onResponseShowCurveEffectChange}
      />
    {/if}
  </div>

  <!-- Both views stay mounted and the inactive one is hidden, so a mode
       switch does not discard the drawing or the loaded response data. -->
  <div class="view-body" class:hidden={viewMode !== VIEW_MODE.CANVAS}>
    <DrawingCanvas
      bind:this={drawingCanvas}
      bind:livePressure
      bind:liveRawPressure
      bind:liveOutputPressure
      bind:info
      {params}
      {brushSize}
      {colorMode}
      {pressureControls}
    />
  </div>

  <div class="view-body" class:hidden={viewMode !== VIEW_MODE.RESPONSE}>
    <PressureResponseView
      bind:livePressure
      bind:liveRawPressure
      bind:liveOutputPressure
      bind:info
      {params}
      data={responseData}
      showCurveEffect={showResponseCurveEffect}
      {showRawIndicator}
      {showEffectiveIndicator}
    />
  </div>
</div>

<style>
  #view-panel {
    width: 100%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .view-controls-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 6px 12px;
    background: #f0f0f0;
    border-bottom: 1px solid #ccc;
    flex-shrink: 0;
  }

  .mode-switch {
    display: inline-flex;
    border: 1px solid #bbb;
    border-radius: 4px;
    overflow: hidden;
  }

  .mode-btn {
    padding: 4px 10px;
    background: #fff;
    border: none;
    border-right: 1px solid #bbb;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    color: #555;
    white-space: nowrap;
  }

  .mode-btn:last-child {
    border-right: none;
  }

  .mode-btn:hover:not(.active) {
    background: #e8e8e8;
  }

  .mode-btn.active {
    background: #5e85a5;
    color: #fff;
    font-weight: 600;
  }

  .view-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .view-body.hidden {
    display: none;
  }

  .toolbar-sep {
    width: 1px;
    align-self: stretch;
    background: #ccc;
  }
</style>
