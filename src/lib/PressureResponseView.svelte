<script>
  import PressureResponseChart from './PressureResponseChart.svelte';
  import { createPressureProcessor, readPointerSample, clearPointerSample, EMPTY_POINTER_INFO } from './pressurePipeline';

  export let params;
  export let data = null;
  export let showCurveEffect = true;
  export let showRawIndicator = true;
  export let showEffectiveIndicator = true;

  export let info = { ...EMPTY_POINTER_INFO };
  export let livePressure = null;
  export let liveRawPressure = null;
  export let liveOutputPressure = null;

  const processor = createPressureProcessor();

  // This view draws nothing, but it still captures pen pressure so the live
  // indicators on the curve and response charts keep tracking: press the pen
  // here and watch where you land on the hardware's force curve.
  function handlePointer(event) {
    ({ liveRawPressure, livePressure, liveOutputPressure, info } =
      readPointerSample(processor, event, params));
  }

  // pointerleave alone is not enough: lifting the pen while still over the
  // pane fires pointerup, which would otherwise leave the indicators parked at
  // the last contact pressure.
  function handlePointerEnd() {
    ({ liveRawPressure, livePressure, liveOutputPressure, info } =
      clearPointerSample(processor));
  }
</script>

<!-- A pen-pressure sensing surface rather than a control: there is no click
     action here to give a keyboard equivalent to. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="response-view"
  on:pointermove={handlePointer}
  on:pointerdown={handlePointer}
  on:pointerup={handlePointerEnd}
  on:pointercancel={handlePointerEnd}
  on:pointerleave={handlePointerEnd}
>
  {#if data}
    <PressureResponseChart
      {data}
      {params}
      {showCurveEffect}
      {liveRawPressure}
      {livePressure}
      {liveOutputPressure}
      {showRawIndicator}
      {showEffectiveIndicator}
      fill={true}
    />
  {:else}
    <div class="response-empty">
      <p>No pressure response data loaded.</p>
      <p class="response-empty-hint">
        Choose a bundled sample or upload a JSON file from the Data control above.
      </p>
    </div>
  {/if}
</div>

<style>
  .response-view {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: #f5f5f0;
    touch-action: none;
    overscroll-behavior: none;
  }

  .response-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #888;
    text-align: center;
  }

  .response-empty p {
    font-size: 13px;
  }

  .response-empty-hint {
    font-size: 12px;
    color: #aaa;
    max-width: 320px;
  }
</style>
