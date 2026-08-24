<script>
  import NamedSlider from './NamedSlider.svelte';
  import { EMA_MAX, EMA_CURVE_EXPONENT } from './emaConstants';
  import { SMOOTHING_TYPE } from './uiConstants';
  import TypeSelectRow from './TypeSelectRow.svelte';

  export let params;
  export let defaultParams;

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }

  const SMOOTHING_TYPE_OPTIONS = [
    { value: SMOOTHING_TYPE.PASSTHROUGH, label: 'Passthrough' },
    { value: SMOOTHING_TYPE.EMA, label: 'EMA' },
  ];

  function handleTypeChange(nextType) {
    patchParams({ smoothingType: nextType });
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
  <TypeSelectRow
    value={smoothingType}
    options={SMOOTHING_TYPE_OPTIONS}
    onChange={handleTypeChange}
    onReset={resetToDefaults}
    resetHiddenFor={SMOOTHING_TYPE.PASSTHROUGH}
    resetTitle="Reset smoothing amount"
  />

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
