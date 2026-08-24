<script>
  import { onMount } from 'svelte';
  import PressureChart from './lib/PressureChart.svelte';
  import DrawingCanvas from './lib/DrawingCanvas.svelte';
  import { CURVE_TYPE } from './lib/curveTypes';
  import { SMOOTHING_ORDER, MIN_APPROACH, HANDLE_MODE } from './lib/uiConstants';

  const DEFAULT_PARAMS = {
    emaSmoothing: 0,
    positionEmaSmoothing: 0,
    smoothingOrder: SMOOTHING_ORDER.SMOOTH_THEN_CURVE,
    softness: 0.0,
    inputMinimum: 0,
    inputMaximum: 1,
    minimum: 0,
    maximum: 1,
    curveType: CURVE_TYPE.BASIC,
    minApproach: MIN_APPROACH.CLAMP,
    transitionWidth: 0,
    flatLevel: 0.5,
    bezierPoints: [
      {
        x: 0,
        y: 0,
        inX: 0,
        inY: 0,
        outX: 0.33,
        outY: 0,
        handleMode: HANDLE_MODE.BROKEN,
      },
      {
        x: 1,
        y: 1,
        inX: 0.67,
        inY: 1,
        outX: 1,
        outY: 1,
        handleMode: HANDLE_MODE.BROKEN,
      },
    ],
  };

  let params = { ...DEFAULT_PARAMS };
  let livePressure = null;
  let liveRawPressure = null;
  let showDriverWarning = true;
  let leftPanelsCollapsed = false;
  function preventContextMenu(event) {
    event.preventDefault();
  }

  onMount(() => {
    document.addEventListener('contextmenu', preventContextMenu);
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  });
</script>

{#if showDriverWarning}
  <div class="driver-warning">
    <span>⚠️ For best results, set your tablet driver's pressure curve to its default (linear) state before using this tool.</span>
    <button type="button" class="driver-warning-dismiss" on:click={() => showDriverWarning = false}>✕</button>
  </div>
{/if}
<div id="layout" class:left-collapsed={leftPanelsCollapsed}>
  <PressureChart bind:params {livePressure} {liveRawPressure} defaultParams={DEFAULT_PARAMS} />
  <DrawingCanvas
    bind:livePressure
    bind:liveRawPressure
    {params}
    {leftPanelsCollapsed}
    onToggleLeftPanels={() => leftPanelsCollapsed = !leftPanelsCollapsed}
  />
</div>
