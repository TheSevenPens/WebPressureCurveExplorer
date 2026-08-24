<script>
  import NamedSlider from './NamedSlider.svelte';
  import { CURVE_TYPE } from './curveTypes';
  import { isIdentityCurve } from './curveMath';
  import { BEZIER_PRESETS } from './bezierPresets';
  import { MIN_APPROACH } from './uiConstants';
  import PressureSmoothingControls from './PressureSmoothingControls.svelte';
  import SmoothingOrderControls from './SmoothingOrderControls.svelte';
  import CollapsibleSection from './CollapsibleSection.svelte';

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
  $: smoothingHasEffect = Number(params.emaSmoothing ?? 0) > 0;
  $: onOff = (active) => (active ? 'on' : 'off');

  const PRESETS_STORAGE_KEY = 'wpe-user-presets';

  let userPresets = loadPresets();
  let showSaveInput = false;
  let savePresetName = '';
  let pendingLoadPreset = null;

  function loadPresets() {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function persistPresets() {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(userPresets));
  }

  function savePreset() {
    const name = savePresetName.trim();
    if (!name) return;
    const existing = userPresets.findIndex((p) => p.name === name);
    const entry = { name, params: JSON.parse(JSON.stringify(params)) };
    if (existing >= 0) {
      userPresets[existing] = entry;
    } else {
      userPresets = [...userPresets, entry];
    }
    persistPresets();
    showSaveInput = false;
    savePresetName = '';
  }

  function confirmLoadPreset(name) {
    pendingLoadPreset = name;
  }

  function applyLoadPreset() {
    const preset = userPresets.find((p) => p.name === pendingLoadPreset);
    if (preset) {
      params = { ...preset.params };
    }
    pendingLoadPreset = null;
  }

  function cancelLoadPreset() {
    pendingLoadPreset = null;
  }

  function deletePreset(name) {
    userPresets = userPresets.filter((p) => p.name !== name);
    persistPresets();
  }

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
    const newType = event.currentTarget.value;
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
    <div class="curve-type-row">
      <select value={params.curveType} on:change={handleCurveTypeChange}>
        <option value={CURVE_TYPE.PASSTHROUGH}>Passthrough</option>
        <option value={CURVE_TYPE.FLAT}>Flat</option>
        <option value={CURVE_TYPE.BASIC}>Basic</option>
        <option value={CURVE_TYPE.EXTENDED}>Extended</option>
        <option value={CURVE_TYPE.SIGMOID}>Sigmoid</option>
        <option value={CURVE_TYPE.BEZIER}>Bezier</option>
      </select>
      {#if params.curveType !== CURVE_TYPE.PASSTHROUGH}
        <button id="btn-reset" on:click={resetToDefaults}>↺</button>
      {/if}
    </div>

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
      <PressureSmoothingControls bind:params />
    </CollapsibleSection>

    <CollapsibleSection title="Processing Order">
      <SmoothingOrderControls bind:params />
    </CollapsibleSection>

    <CollapsibleSection title="Presets" open={false}>
      {#if pendingLoadPreset}
        <div class="preset-confirm">
          Load "{pendingLoadPreset}"? This will replace all current settings.
          <div class="preset-confirm-buttons">
            <button type="button" class="small-action-btn" on:click={applyLoadPreset}>Yes</button>
            <button type="button" class="small-action-btn" on:click={cancelLoadPreset}>Cancel</button>
          </div>
        </div>
      {/if}

      {#if userPresets.length > 0}
        <div class="preset-list">
          {#each userPresets as preset}
            <div class="preset-item">
              <button type="button" class="preset-load-btn" on:click={() => confirmLoadPreset(preset.name)}>
                {preset.name}
              </button>
              <button type="button" class="preset-delete-btn" on:click={() => deletePreset(preset.name)}>✕</button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="preset-empty">No saved presets</div>
      {/if}

      <button type="button" class="small-action-btn" on:click={() => showSaveInput = true}>Save settings</button>

      {#if showSaveInput}
        <div class="preset-dialog-overlay" on:click|self={() => { showSaveInput = false; savePresetName = ''; }}>
          <div class="preset-dialog">
            <div class="preset-dialog-title">Save preset</div>
            <input
              type="text"
              class="preset-name-input"
              placeholder="Preset name"
              bind:value={savePresetName}
              on:keydown={(e) => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') { showSaveInput = false; savePresetName = ''; } }}
            />
            <div class="preset-dialog-buttons">
              <button type="button" class="small-action-btn" on:click={savePreset}>Save</button>
              <button type="button" class="small-action-btn" on:click={() => { showSaveInput = false; savePresetName = ''; }}>Cancel</button>
            </div>
          </div>
        </div>
      {/if}
    </CollapsibleSection>
  </div>
</div>