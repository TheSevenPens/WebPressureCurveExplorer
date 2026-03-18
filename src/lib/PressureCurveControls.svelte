<script>
  import NamedSlider from './NamedSlider.svelte';
  import PositionControls from './PositionControls.svelte';
  import PressureSmoothingControls from './PressureSmoothingControls.svelte';
  import PressureResponsePanel from './PressureResponsePanel.svelte';

  export let params;
  export let defaultParams;
  export let curveActive = true;
  export let flatActive = false;
  export let bezierActive = false;
  export let canAddBezierPoint = false;
  export let canRemoveBezierPoint = false;
  export let onAddBezierPoint = () => {};
  export let onRemoveBezierPoint = () => {};
  export let onResponseDataChange = () => {};
  export let onResponseShowCurveEffectChange = () => {};

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }

  function handleSliderValue(key, nextValue) {
    let value = Number(nextValue);

    if (key === 'inputMinimum' && value > params.inputMaximum - 0.01) {
      value = params.inputMaximum - 0.01;
    } else if (key === 'inputMaximum' && value < params.inputMinimum + 0.01) {
      value = params.inputMinimum + 0.01;
    } else if (key === 'minimum' && value > params.maximum) {
      value = params.maximum;
    } else if (key === 'maximum' && value < params.minimum) {
      value = params.minimum;
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

    if (params.curveType === 'bezier') {
      const defaultBezierPoints = Array.isArray(defaultParams.bezierPoints)
        ? defaultParams.bezierPoints.map((point) => ({ ...point }))
        : [{ x: 0, y: 0 }, { x: 1, y: 1 }];

      patchParams({ bezierPoints: defaultBezierPoints });
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
    <PositionControls bind:params />
    <PressureSmoothingControls bind:params />

    <div class="param">
      <div class="param-header">
        <span class="param-name">CurveType</span>
      </div>
      <select value={params.curveType} on:change={handleCurveTypeChange}>
        <option value="null-effect">Null-effect</option>
        <option value="flat">Flat</option>
        <option value="basic">Basic</option>
        <option value="sigmoid">Sigmoid</option>
        <option value="bezier">Bezier</option>
      </select>
    </div>

    {#if bezierActive}
      <div class="bezier-points-actions">
        <button
          type="button"
          class="small-action-btn"
          on:click={onAddBezierPoint}
          disabled={!canAddBezierPoint}
        >
          Add point
        </button>
        <button
          type="button"
          class="small-action-btn"
          on:click={onRemoveBezierPoint}
          disabled={!canRemoveBezierPoint}
        >
          Remove point
        </button>
      </div>
    {/if}

    {#if flatActive}
      <NamedSlider
        name="Height"
        value={params.flatLevel}
        min={0}
        max={1}
        step={0.01}
        sliderMin={0}
        sliderMax={1}
        sliderStep={0.01}
        valueDecimals={2}
        valuePrecision={2}
        defaultValue={defaultParams.flatLevel}
        onValueChange={(value) => handleSliderValue('flatLevel', value)}
      />
    {/if}

    {#if curveActive}
      <NamedSlider
        name="CurveAmount"
        value={params.softness}
        min={-0.9}
        max={0.9}
        step={0.01}
        sliderMin={-0.9}
        sliderMax={0.9}
        sliderStep={0.01}
        valueDecimals={2}
        valuePrecision={2}
        defaultValue={defaultParams.softness}
        onValueChange={(value) => handleSliderValue('softness', value)}
      />
    {/if}

    {#if false}
      <NamedSlider
        name="Transition"
        value={params.transitionWidth}
        min={0}
        max={0.5}
        step={0.01}
        sliderMin={0}
        sliderMax={0.5}
        sliderStep={0.01}
        valueDecimals={2}
        valuePrecision={2}
        onValueChange={(value) => handleSliderValue('transitionWidth', value)}
      />
    {/if}

    {#if curveActive}
      <NamedSlider
        name="InputMinimum"
        value={params.inputMinimum}
        min={0}
        max={1}
        step={0.01}
        sliderMin={0}
        sliderMax={1}
        sliderStep={0.01}
        valueDecimals={2}
        valuePrecision={2}
        defaultValue={defaultParams.inputMinimum}
        onValueChange={(value) => handleSliderValue('inputMinimum', value)}
      />
    {/if}

    {#if curveActive}
      <NamedSlider
        name="InputMaximum"
        value={params.inputMaximum}
        min={0}
        max={1}
        step={0.01}
        sliderMin={0}
        sliderMax={1}
        sliderStep={0.01}
        valueDecimals={2}
        valuePrecision={2}
        defaultValue={defaultParams.inputMaximum}
        onValueChange={(value) => handleSliderValue('inputMaximum', value)}
      />
    {/if}

    {#if curveActive}
      <NamedSlider
        name="OutputMinimum"
        value={params.minimum}
        min={0}
        max={1}
        step={0.01}
        sliderMin={0}
        sliderMax={1}
        sliderStep={0.01}
        valueDecimals={2}
        valuePrecision={2}
        defaultValue={defaultParams.minimum}
        onValueChange={(value) => handleSliderValue('minimum', value)}
      />
    {/if}

    {#if curveActive}
      <NamedSlider
        name="OutputMaximum"
        value={params.maximum}
        min={0}
        max={1}
        step={0.01}
        sliderMin={0}
        sliderMax={1}
        sliderStep={0.01}
        valueDecimals={2}
        valuePrecision={2}
        defaultValue={defaultParams.maximum}
        onValueChange={(value) => handleSliderValue('maximum', value)}
      />
    {/if}

    {#if params.curveType !== 'null-effect'}
      <button id="btn-reset" on:click={resetToDefaults}>Reset curve</button>
    {/if}

    <PressureResponsePanel
      onDataChange={onResponseDataChange}
      onShowCurveEffectChange={onResponseShowCurveEffectChange}
    />
  </div>
</div>