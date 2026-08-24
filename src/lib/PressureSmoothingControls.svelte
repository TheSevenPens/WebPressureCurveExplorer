<script>
  import NamedSlider from './NamedSlider.svelte';
  import { EMA_MAX, EMA_CURVE_EXPONENT } from './emaConstants';
  import { SMOOTHING_TYPE } from './uiConstants';

  export let params;
  export let defaultParams;

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }

  function handleTypeChange(event) {
    patchParams({ smoothingType: event.currentTarget.value });
  }

  function handleEmaChange(nextValue) {
    patchParams({ emaSmoothing: nextValue });
  }

  function resetToDefaults() {
    patchParams({ emaSmoothing: defaultParams.emaSmoothing });
  }

  $: smoothingType = params.smoothingType ?? SMOOTHING_TYPE.EMA;
</script>

<div class="param-group">
  <div class="type-row">
    <select value={smoothingType} on:change={handleTypeChange}>
      <option value={SMOOTHING_TYPE.PASSTHROUGH}>Passthrough</option>
      <option value={SMOOTHING_TYPE.EMA}>EMA</option>
    </select>
    {#if smoothingType !== SMOOTHING_TYPE.PASSTHROUGH}
      <button class="btn-reset" on:click={resetToDefaults}>↺</button>
    {/if}
  </div>

  {#if smoothingType === SMOOTHING_TYPE.EMA}
    <NamedSlider
      name="Smoothing Amount"
      value={params.emaSmoothing ?? 0}
      min={0}
      max={EMA_MAX}
      sliderMin={0}
      sliderMax={1}
      sliderStep={0.001}
      curved={true}
      curveExponent={EMA_CURVE_EXPONENT}
      valueDecimals={2}
      valuePrecision={3}
      defaultValue={defaultParams.emaSmoothing}
      onValueChange={handleEmaChange}
    />
  {/if}
</div>
