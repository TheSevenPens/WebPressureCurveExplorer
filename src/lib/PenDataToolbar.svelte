<script>
  import { SMOOTHING_ORDER } from './uiConstants';

  export let info;
  export let el = undefined;
</script>

<div class="pen-data-toolbar" bind:this={el}>
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

<style>
  .pen-data-toolbar {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    padding: 6px 12px;
    background: #f0f0f0;
    border-bottom: 1px solid #ccc;
    flex-shrink: 0;
  }

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
</style>
