<script>
  import { SMOOTHING_ORDER, COLOR_MODE, PRESSURE_CONTROL } from './uiConstants';

  export let info;
  export let onClear = () => {};
  export let el = undefined;
  export let brushSize = 40;
  export let onBrushSizeChange = () => {};
  export let colorMode = COLOR_MODE.BLACK;
  export let onColorModeChange = () => {};
  export let pressureControls = PRESSURE_CONTROL.SIZE;
  export let onPressureControlsChange = () => {};
  export let leftPanelsCollapsed = false;
  export let onToggleLeftPanels = () => {};
</script>

<div id="toolbar" bind:this={el}>
  <div class="toolbar-row toolbar-data">
    <span class="info-item">Type: <span class="val type-val">{info.type}</span></span>
    {#if info.smoothingOrder === SMOOTHING_ORDER.CURVE_THEN_SMOOTH}
      <span class="info-item">
        Pressure: <span class="val mono">{info.pressureRaw}</span>
        <span class="arrow">→</span>
        <span class="val mono">{info.pressureCurved}</span>
        <span class="arrow">→</span>
        <span class="val mono mapped">{info.pressureOutput}</span>
      </span>
    {:else}
      <span class="info-item">
        Pressure: <span class="val mono">{info.pressureRaw}</span>
        <span class="arrow">→</span>
        <span class="val mono">{info.pressureSmoothed}</span>
        <span class="arrow">→</span>
        <span class="val mono mapped">{info.pressureOutput}</span>
      </span>
    {/if}
    <span class="info-item">Tilt X: <span class="val mono">{info.tiltX}</span></span>
    <span class="info-item">Tilt Y: <span class="val mono">{info.tiltY}</span></span>
    <span class="info-item">Azimuth: <span class="val mono">{info.azimuth}</span></span>
    <span class="info-item">Altitude: <span class="val mono">{info.altitude}</span></span>
  </div>
  <div class="toolbar-row toolbar-controls">
    <button
      id="btn-toggle-panels"
      type="button"
      aria-pressed={leftPanelsCollapsed}
      title={leftPanelsCollapsed ? 'Show the curve and controls panels' : 'Hide the curve and controls panels for maximum canvas area'}
      on:click={onToggleLeftPanels}
    >{leftPanelsCollapsed ? '» Show controls' : '« Hide controls'}</button>
    <button id="btn-clear" on:click={onClear}>Clear</button>
    <span class="info-item">
      Color:
      <select class="toolbar-select" value={colorMode} on:change={(e) => onColorModeChange(e.currentTarget.value)}>
        <option value={COLOR_MODE.BLACK}>Black</option>
        <option value={COLOR_MODE.RANDOM}>Random</option>
      </select>
    </span>
    <span class="info-item">
      Pressure controls:
      <select class="toolbar-select" value={pressureControls} on:change={(e) => onPressureControlsChange(e.currentTarget.value)}>
        <option value={PRESSURE_CONTROL.SIZE}>Size</option>
        <option value={PRESSURE_CONTROL.OPACITY}>Opacity</option>
      </select>
    </span>
    <span class="info-item brush-size-control">
      Brush:
      <input
        type="range"
        min="1"
        max="500"
        step="1"
        value={brushSize}
        on:input={(e) => onBrushSizeChange(parseInt(e.currentTarget.value, 10))}
      />
      <input
        type="number"
        class="brush-size-input"
        min="1"
        max="500"
        step="1"
        value={brushSize}
        on:change={(e) => {
          const v = Math.min(500, Math.max(1, parseInt(e.currentTarget.value, 10) || 40));
          onBrushSizeChange(v);
        }}
      />
    </span>
  </div>
</div>

<style>
  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .toolbar-controls {
    gap: 10px;
  }

  /* Reserve room for the longest pointerType ("mouse"/"touch") so switching
     input devices does not shift everything to the right of it. .val is
     monospace, so ch units size this exactly. */
  .type-val {
    display: inline-block;
    min-width: 5ch;
    text-align: left;
  }

  .mono {
    font-family: Consolas, 'Courier New', monospace;
    font-variant-numeric: tabular-nums;
    display: inline-block;
    min-width: 3.8em;
    text-align: right;
  }

  .brush-size-control {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .brush-size-control input[type="range"] {
    width: 80px;
  }

  .toolbar-select {
    font-size: 12px;
    padding: 1px 3px;
  }

  .brush-size-input {
    width: 42px;
    font-size: 12px;
    padding: 1px 3px;
    text-align: right;
  }
</style>
