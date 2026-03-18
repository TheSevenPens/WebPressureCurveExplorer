<script>
  import { onMount } from 'svelte';

  export let name = 'Value';
  export let value = 0;
  export let min = 0;
  export let max = 1;
  export let step = 0.01;
  export let sliderMin = 0;
  export let sliderMax = 1;
  export let sliderStep = step;
  export let curved = false;
  export let curveExponent = 1;
  export let valueDecimals = 2;
  export let valuePrecision = null;
  export let defaultValue = value;
  export let onValueChange = () => {};

  let contextMenuOpen = false;
  let contextMenuX = 0;
  let contextMenuY = 0;

  let editing = false;
  let editRawValue = '';

  function startEdit() {
    editRawValue = formatValue(value);
    editing = true;
  }

  function commitEdit() {
    editing = false;
    const parsed = parseFloat(editRawValue);
    if (!Number.isNaN(parsed)) {
      applyValue(parsed);
    }
  }

  function handleEditKeyDown(event) {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      editing = false;
    }
  }

  function autofocus(node) {
    node.focus();
    node.select();
  }

  function clamp(valueToClamp, minValue, maxValue) {
    return Math.min(maxValue, Math.max(minValue, valueToClamp));
  }

  function valueToSlider(currentValue) {
    const safeValue = clamp(Number(currentValue) || 0, min, max);

    if (!curved || curveExponent === 1) {
      return safeValue;
    }

    const valueRange = max - min;
    const sliderRange = sliderMax - sliderMin;
    if (valueRange <= 0 || sliderRange <= 0) return sliderMin;

    const normalized = (safeValue - min) / valueRange;
    const t = normalized <= 0 ? 0 : Math.pow(normalized, 1 / curveExponent);
    return sliderMin + t * sliderRange;
  }

  function sliderToValue(sliderValue) {
    const safeSlider = clamp(Number(sliderValue) || 0, sliderMin, sliderMax);

    if (!curved || curveExponent === 1) {
      return clamp(safeSlider, min, max);
    }

    const sliderRange = sliderMax - sliderMin;
    const valueRange = max - min;
    if (valueRange <= 0 || sliderRange <= 0) return min;

    const t = (safeSlider - sliderMin) / sliderRange;
    return min + Math.pow(t, curveExponent) * valueRange;
  }

  function formatValue(currentValue) {
    return Number(currentValue).toFixed(valueDecimals);
  }

  function handleInput(event) {
    let nextValue = sliderToValue(parseFloat(event.currentTarget.value));
    if (typeof valuePrecision === 'number' && Number.isFinite(valuePrecision)) {
      const scale = 10 ** valuePrecision;
      nextValue = Math.round(nextValue * scale) / scale;
    }
    onValueChange(nextValue);
  }

  function applyValue(nextValue) {
    let v = clamp(nextValue, min, max);
    if (typeof valuePrecision === 'number' && Number.isFinite(valuePrecision)) {
      const scale = 10 ** valuePrecision;
      v = Math.round(v * scale) / scale;
    }
    onValueChange(v);
    contextMenuOpen = false;
  }

  function handleContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    contextMenuOpen = true;
  }

  function closeContextMenu() {
    contextMenuOpen = false;
  }

  onMount(() => {
    document.addEventListener('click', closeContextMenu);
    return () => document.removeEventListener('click', closeContextMenu);
  });
</script>

<div class="param">
  <div class="param-header">
    <span class="param-name">{name}</span>
    {#if editing}
      <input
        class="param-value-edit"
        type="text"
        bind:value={editRawValue}
        on:blur={commitEdit}
        on:keydown={handleEditKeyDown}
        use:autofocus
      >
    {:else}
      <span class="param-value" on:click={startEdit}>{formatValue(value)}</span>
    {/if}
  </div>
  <input
    class="named-slider-input"
    type="range"
    min={sliderMin}
    max={sliderMax}
    step={sliderStep}
    value={valueToSlider(value)}
    on:input={handleInput}
    on:contextmenu={handleContextMenu}
  >
</div>

{#if contextMenuOpen}
  <div
    class="slider-context-menu"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
    on:click|stopPropagation
  >
    <button type="button" on:click={() => applyValue(min)}>Min</button>
    <button type="button" on:click={() => applyValue(max)}>Max</button>
    <button type="button" on:click={() => applyValue(defaultValue)}>Reset</button>
  </div>
{/if}

<style>
  .param-value {
    cursor: text;
  }

  .param-value-edit {
    width: 52px;
    font-size: 11px;
    font-family: inherit;
    text-align: right;
    border: 1px solid #aaaacc;
    border-radius: 3px;
    padding: 0 3px;
    background: #ffffff;
    color: #222;
    outline: none;
  }

  .named-slider-input {
    width: 100%;
    height: 4px;
    cursor: pointer;
    accent-color: var(--slider-accent);
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }

  .named-slider-input::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: var(--slider-track);
  }

  .named-slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--slider-accent);
    margin-top: -2.5px;
  }

  .named-slider-input::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background: var(--slider-track);
  }

  .named-slider-input::-moz-range-thumb {
    width: 9px;
    height: 9px;
    border: 0;
    border-radius: 50%;
    background: var(--slider-accent);
  }

  .slider-context-menu {
    position: fixed;
    z-index: 1000;
    background: #ffffff;
    border: 1px solid #d0d0d8;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    min-width: 80px;
    padding: 3px 0;
  }

  .slider-context-menu button {
    background: none;
    border: none;
    padding: 5px 12px;
    text-align: left;
    font-size: 12px;
    cursor: pointer;
    color: #222;
  }

  .slider-context-menu button:hover {
    background: #f0f0f8;
  }
</style>
