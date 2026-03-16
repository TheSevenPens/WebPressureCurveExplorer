<script>
  export let info;
  export let onClear = () => {};
  export let el = undefined;
</script>

<div id="toolbar" bind:this={el}>
  <button id="btn-clear" on:click={onClear}>Clear</button>
  <span class="info-item">Type: <span class="val">{info.type}</span></span>
  <span class="info-item">
    Pressure: <span class="val">{info.pressureRaw}</span>
    <span class="arrow">→</span>
    <span class="val">{info.pressureSmoothed}</span>
    <span class="arrow">→</span>
    <span class="val mapped">{info.pressureMapped}</span>
  </span>
  <span class="info-item">Tilt X: <span class="val">{info.tiltX}</span></span>
  <span class="info-item">Tilt Y: <span class="val">{info.tiltY}</span></span>
  <span class="info-item">Azimuth: <span class="val">{info.azimuth}</span></span>
  <span class="info-item">Altitude: <span class="val">{info.altitude}</span></span>
</div>
