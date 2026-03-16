<script>
  export let params;
  export let defaultParams;
  export let curveActive = true;
  export let flatActive = false;
  export let customActive = false;
  export let canAddCustomPoint = false;
  export let canRemoveCustomPoint = false;
  export let onAddCustomPoint = () => {};
  export let onRemoveCustomPoint = () => {};

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

  function handleEmaInput(event) {
    const mapped = sliderToEma(parseFloat(event.currentTarget.value));
    patchParams({ emaSmoothing: Math.round(mapped * 1000) / 1000 });
  }

  function handleSliderInput(key, event) {
    let value = parseFloat(event.currentTarget.value);

    if (key === 'inputMinimum' && value > params.inputMaximum - 0.01) {
      value = params.inputMaximum - 0.01;
      event.currentTarget.value = String(value);
    } else if (key === 'inputMaximum' && value < params.inputMinimum + 0.01) {
      value = params.inputMinimum + 0.01;
      event.currentTarget.value = String(value);
    } else if (key === 'minimum' && value > params.maximum) {
      value = params.maximum;
      event.currentTarget.value = String(value);
    } else if (key === 'maximum' && value < params.minimum) {
      value = params.minimum;
      event.currentTarget.value = String(value);
    }

    patchParams({ [key]: value });
  }

  function handleCurveTypeChange(event) {
    patchParams({ curveType: event.currentTarget.value });
  }

  function resetToDefaults() {
    if (params.curveType === 'flat') {
      patchParams({ flatLevel: defaultParams.flatLevel });
      return;
    }

    if (params.curveType === 'custom') {
      const defaultCustomPoints = Array.isArray(defaultParams.customPoints)
        ? defaultParams.customPoints.map((point) => ({ ...point }))
        : [{ x: 0, y: 0 }, { x: 1, y: 1 }];

      patchParams({ customPoints: defaultCustomPoints });
      return;
    }

    patchParams({
      softness: defaultParams.softness,
      inputMinimum: defaultParams.inputMinimum,
      inputMaximum: defaultParams.inputMaximum,
      minimum: defaultParams.minimum,
      maximum: defaultParams.maximum,
      transitionWidth: defaultParams.transitionWidth,
    });
  }
</script>

<div id="panel-right">
  <div id="controls">
    <div class="param-group">
      <div class="param-group-title">Input Smoothing</div>
      <div class="param">
        <div class="param-header">
          <span class="param-name">Pressure EMA</span>
          <span class="param-value">{formatValue(params.emaSmoothing ?? 0)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={emaToSlider(params.emaSmoothing ?? 0)}
          on:input={handleEmaInput}
        >
      </div>
    </div>

    <div class="param">
      <div class="param-header">
        <span class="param-name">CurveType</span>
      </div>
      <select value={params.curveType} on:change={handleCurveTypeChange}>
        <option value="null-effect">Null-effect</option>
        <option value="flat">Flat</option>
        <option value="power">Power</option>
        <option value="sigmoid">Sigmoid</option>
        <option value="custom">Custom</option>
      </select>
    </div>

    {#if customActive}
      <div class="custom-points-actions">
        <button
          type="button"
          class="small-action-btn"
          on:click={onAddCustomPoint}
          disabled={!canAddCustomPoint}
        >
          Add point
        </button>
        <button
          type="button"
          class="small-action-btn"
          on:click={onRemoveCustomPoint}
          disabled={!canRemoveCustomPoint}
        >
          Remove point
        </button>
      </div>
    {/if}

    {#if flatActive}
      <div class="param">
        <div class="param-header">
          <span class="param-name">FlatLevel</span>
          <span class="param-value">{formatValue(params.flatLevel)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={params.flatLevel}
          on:input={(e) => handleSliderInput('flatLevel', e)}
        >
      </div>
    {/if}

    {#if curveActive}
      <div class="param">
        <div class="param-header">
          <span class="param-name">CurveAmount</span>
          <span class="param-value">{formatValue(params.softness)}</span>
        </div>
        <input
          type="range"
          min="-0.9"
          max="0.9"
          step="0.01"
          value={params.softness}
          on:input={(e) => handleSliderInput('softness', e)}
        >
      </div>
    {/if}

    {#if false}
      <div class="param">
        <div class="param-header">
          <span class="param-name">Transition</span>
          <span class="param-value">{formatValue(params.transitionWidth)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          value={params.transitionWidth}
          on:input={(e) => handleSliderInput('transitionWidth', e)}
        >
      </div>
    {/if}

    {#if curveActive}
      <div class="param">
        <div class="param-header">
          <span class="param-name">InputMinimum</span>
          <span class="param-value">{formatValue(params.inputMinimum)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={params.inputMinimum}
          on:input={(e) => handleSliderInput('inputMinimum', e)}
        >
      </div>
    {/if}

    {#if curveActive}
      <div class="param">
        <div class="param-header">
          <span class="param-name">InputMaximum</span>
          <span class="param-value">{formatValue(params.inputMaximum)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={params.inputMaximum}
          on:input={(e) => handleSliderInput('inputMaximum', e)}
        >
      </div>
    {/if}

    {#if curveActive}
      <div class="param">
        <div class="param-header">
          <span class="param-name">OutputMinimum</span>
          <span class="param-value">{formatValue(params.minimum)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={params.minimum}
          on:input={(e) => handleSliderInput('minimum', e)}
        >
      </div>
    {/if}

    {#if curveActive}
      <div class="param">
        <div class="param-header">
          <span class="param-name">OutputMaximum</span>
          <span class="param-value">{formatValue(params.maximum)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={params.maximum}
          on:input={(e) => handleSliderInput('maximum', e)}
        >
      </div>
    {/if}

    {#if params.curveType !== 'null-effect'}
      <button id="btn-reset" on:click={resetToDefaults}>Reset curve</button>
    {/if}
  </div>
</div>
