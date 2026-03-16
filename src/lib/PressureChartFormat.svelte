<script>
  export let showGrid = true;
  export let showLabels = true;
  export let showNodes = true;
  export let showNodeGuides = true;
  export let curveActive = true;
  export let onToggle = () => {};
</script>

<label class="checkbox-row">
  <input
    type="checkbox"
    bind:checked={showGrid}
    on:change={onToggle}
  >
  <span class="param-name">Show Grid</span>
</label>

<label class="checkbox-row">
  <input
    type="checkbox"
    bind:checked={showLabels}
    on:change={onToggle}
  >
  <span class="param-name">Show Labels</span>
</label>

<label class="checkbox-row" class:disabled={!curveActive}>
  <input
    type="checkbox"
    bind:checked={showNodes}
    disabled={!curveActive}
    on:change={onToggle}
  >
  <span class="param-name">Show Nodes</span>
</label>

<label class="checkbox-row" class:disabled={!curveActive}>
  <input
    type="checkbox"
    bind:checked={showNodeGuides}
    disabled={!curveActive}
    on:change={onToggle}
  >
  <span class="param-name">Show Node Guides</span>
</label>
