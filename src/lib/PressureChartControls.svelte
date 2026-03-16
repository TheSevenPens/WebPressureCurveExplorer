<script>
  export let params;
  export let defaultParams;
  export let curveActive = true;
  export let flatActive = false;

  function formatValue(value) {
    return Number(value).toFixed(2);
  }

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
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
    params = { ...defaultParams };
  }
</script>

<div id="panel-right">
  <div id="controls">
    <div class="param">
      <div class="param-header">
        <span class="param-name">CurveType</span>
      </div>
      <select value={params.curveType} on:change={handleCurveTypeChange}>
        <option value="null">Null</option>
        <option value="flat">Flat</option>
        <option value="power">Power</option>
        <option value="sigmoid">Sigmoid</option>
      </select>
    </div>

    <div class="param" class:disabled={!flatActive}>
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
        disabled={!flatActive}
        on:input={(e) => handleSliderInput('flatLevel', e)}
      >
    </div>

    <div class="param" class:disabled={!curveActive}>
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
        disabled={!curveActive}
        on:input={(e) => handleSliderInput('softness', e)}
      >
    </div>

    <div class="param" style="display:none">
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
        disabled={!curveActive}
        on:input={(e) => handleSliderInput('transitionWidth', e)}
      >
    </div>

    <div class="param" class:disabled={!curveActive}>
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
        disabled={!curveActive}
        on:input={(e) => handleSliderInput('inputMinimum', e)}
      >
    </div>

    <div class="param" class:disabled={!curveActive}>
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
        disabled={!curveActive}
        on:input={(e) => handleSliderInput('inputMaximum', e)}
      >
    </div>

    <div class="param" class:disabled={!curveActive}>
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
        disabled={!curveActive}
        on:input={(e) => handleSliderInput('minimum', e)}
      >
    </div>

    <div class="param" class:disabled={!curveActive}>
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
        disabled={!curveActive}
        on:input={(e) => handleSliderInput('maximum', e)}
      >
    </div>

    <button id="btn-reset" on:click={resetToDefaults}>Reset to Defaults</button>
  </div>
</div>
