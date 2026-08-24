<script>
  /**
   * The type selector + reset row shared by the Curve and Smoothing cards.
   * `options` is a list of `{ value, label }`; the reset button is hidden for
   * `resetHiddenFor`, matching how passthrough exposes nothing to reset.
   */
  export let value;
  export let options = [];
  export let onChange = () => {};
  export let onReset = () => {};
  export let resetHiddenFor = null;
  export let resetTitle = 'Reset to defaults';
</script>

<div class="type-row">
  <select {value} on:change={(e) => onChange(e.currentTarget.value)}>
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if value !== resetHiddenFor}
    <button class="btn-reset" type="button" title={resetTitle} on:click={onReset}>↺</button>
  {/if}
</div>
