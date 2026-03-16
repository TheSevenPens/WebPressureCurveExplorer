<script>
  export let params;

  const EMA_MAX = 0.99;
  const EMA_MID_TARGET = 0.8;
  const EMA_CURVE_EXPONENT = Math.log(EMA_MID_TARGET / EMA_MAX) / Math.log(0.5);

  function formatValue(value) {
    return Number(value).toFixed(2);
  }

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }

  function sliderToEma(sliderValue) {
    const t = Math.min(1, Math.max(0, Number(sliderValue) || 0));
    return EMA_MAX * Math.pow(t, EMA_CURVE_EXPONENT);
  }

  function emaToSlider(emaValue) {
    const y = Math.min(EMA_MAX, Math.max(0, Number(emaValue) || 0));
    if (y <= 0) return 0;
    return Math.pow(y / EMA_MAX, 1 / EMA_CURVE_EXPONENT);
  }

  function handlePositionEmaInput(event) {
    const mapped = sliderToEma(parseFloat(event.currentTarget.value));
    patchParams({ positionEmaSmoothing: Math.round(mapped * 1000) / 1000 });
  }
</script>

<div class="param-group">
  <div class="param-group-title">Position Smoothing</div>
  <div class="param">
    <div class="param-header">
      <span class="param-name">Position EMA</span>
      <span class="param-value">{formatValue(params.positionEmaSmoothing ?? 0)}</span>
    </div>
    <input
      type="range"
      min="0"
      max="1"
      step="0.001"
      value={emaToSlider(params.positionEmaSmoothing ?? 0)}
      on:input={handlePositionEmaInput}
    >
  </div>
</div>
