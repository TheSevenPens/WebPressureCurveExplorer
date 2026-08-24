<script>
  import NamedSlider from './NamedSlider.svelte';
  import { CURVE_TYPE } from './curveTypes';
  import { isIdentityCurve } from './curveMath';
  import { BEZIER_PRESETS } from './bezierPresets';
  import { MIN_APPROACH, SMOOTHING_TYPE } from './uiConstants';
  import PressureSmoothingControls from './PressureSmoothingControls.svelte';
  import SmoothingOrderControls from './SmoothingOrderControls.svelte';
  import CollapsibleSection from './CollapsibleSection.svelte';
  import TypeSelectRow from './TypeSelectRow.svelte';
  import UserPresetsSection from './UserPresetsSection.svelte';

  export let params;
  export let defaultParams;
  export let curveActive = true;
  export let flatActive = false;
  export let bezierActive = false;
  export let canAddBezierPoint = false;
  export let canRemoveBezierPoint = false;
  export let onAddBezierPoint = () => {};
  export let onRemoveBezierPoint = () => {};

  // Card titles report whether each stage actually changes the pressure.
  $: curveHasEffect = !isIdentityCurve(params);
  $: smoothingHasEffect = (params.smoothingType ?? SMOOTHING_TYPE.EMA) !== SMOOTHING_TYPE.PASSTHROUGH
    && Number(params.emaSmoothing ?? 0) > 0;
  $: onOff = (active) => (active ? 'on' : 'off');

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

  const CURVE_TYPE_OPTIONS = [
    { value: CURVE_TYPE.PASSTHROUGH, label: 'Passthrough' },
    { value: CURVE_TYPE.FLAT, label: 'Flat' },
    { value: CURVE_TYPE.BASIC, label: 'Basic' },
    { value: CURVE_TYPE.EXTENDED, label: 'Extended' },
    { value: CURVE_TYPE.SIGMOID, label: 'Sigmoid' },
    { value: CURVE_TYPE.BEZIER, label: 'Bezier' },
  ];

  function handleCurveTypeChange(newType) {
    const updates = { curveType: newType };
    if (newType === CURVE_TYPE.BASIC) {
      updates.inputMinimum = 0;
      updates.inputMaximum = 1;
      updates.minimum = 0;
      updates.maximum = 1;
      updates.minApproach = MIN_APPROACH.CLAMP;
    }
    patchParams(updates);
  }

  function handleBezierPreset(event) {
    const name = event.currentTarget.value;
    if (!name) return;
    const preset = BEZIER_PRESETS.find((p) => p.name === name);
    if (preset) {
      patchParams({ bezierPoints: preset.points.map((p) => ({ ...p })) });
    }
    event.currentTarget.value = '';
  }

  function resetToDefaults() {
    if (params.curveType === CURVE_TYPE.FLAT) {
      patchParams({ flatLevel: defaultParams.flatLevel });
      return;
    }

    if (params.curveType === CURVE_TYPE.BEZIER) {
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
      minApproach: defaultParams.minApproach,
    });
  }
</script>

<div id="details-panel">
  <div id="details-controls">
    <CollapsibleSection title="Curve ({onOff(curveHasEffect)})" open={true}>
    <TypeSelectRow
      value={params.curveType}
      options={CURVE_TYPE_OPTIONS}
      onChange={handleCurveTypeChange}
      onReset={resetToDefaults}
      resetHiddenFor={CURVE_TYPE.PASSTHROUGH}
      resetTitle="Reset curve to defaults"
    />

    {#if bezierActive}
      <div class="param">
        <div class="param-header">
          <span class="param-name">Preset</span>
        </div>
        <select value="" on:change={handleBezierPreset}>
          <option value="">Select a preset...</option>
          {#each BEZIER_PRESETS as preset}
            <option value={preset.name}>{preset.name}</option>
          {/each}
        </select>
      </div>
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
        name="Curve Amount"
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


    {#if params.curveType === CURVE_TYPE.EXTENDED || params.curveType === CURVE_TYPE.SIGMOID}
      <div class="node-values-table">
        <span class="node-label">Input Min</span><span class="node-value">{params.inputMinimum.toFixed(2)}</span>
        <span class="node-label">Input Max</span><span class="node-value">{params.inputMaximum.toFixed(2)}</span>
        <span class="node-label">Output Min</span><span class="node-value">{params.minimum.toFixed(2)}</span>
        <span class="node-label">Output Max</span><span class="node-value">{params.maximum.toFixed(2)}</span>
      </div>

      <div class="param inline-radio-row">
        <span class="param-name">Min approach</span>
        <label>
          <input
            type="radio"
            name="minApproach"
            value="clamp"
            checked={params.minApproach === MIN_APPROACH.CLAMP}
            on:change={() => patchParams({ minApproach: MIN_APPROACH.CLAMP })}
          />
          Clamp
        </label>
        <label>
          <input
            type="radio"
            name="minApproach"
            value="cut"
            checked={params.minApproach === MIN_APPROACH.CUT}
            on:change={() => patchParams({ minApproach: MIN_APPROACH.CUT })}
          />
          Cut
        </label>
      </div>
    {/if}

    </CollapsibleSection>

    <CollapsibleSection title="Smoothing ({onOff(smoothingHasEffect)})">
      <PressureSmoothingControls bind:params {defaultParams} />
    </CollapsibleSection>

    <CollapsibleSection title="Processing Order">
      <SmoothingOrderControls bind:params />
    </CollapsibleSection>

    <CollapsibleSection title="Presets" open={false}>
      <UserPresetsSection bind:params />
    </CollapsibleSection>
  </div>
</div>