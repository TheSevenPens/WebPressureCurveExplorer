<script>
  import { COLOR_MODE, PRESSURE_CONTROL } from './uiConstants';

  export let onClear = () => {};
  export let brushSize = 40;
  export let onBrushSizeChange = () => {};
  export let colorMode = COLOR_MODE.BLACK;
  export let onColorModeChange = () => {};
  export let pressureControls = PRESSURE_CONTROL.SIZE;
  export let onPressureControlsChange = () => {};
</script>

<button class="btn-clear" type="button" on:click={onClear}>Clear</button>
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

<style>
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
