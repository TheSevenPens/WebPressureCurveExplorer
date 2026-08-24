<script>
  import { onMount } from 'svelte';
  import PressureChart from './lib/PressureChart.svelte';
  import ViewPanel from './lib/ViewPanel.svelte';
  import { CURVE_TYPE } from './lib/curveTypes';
  import { SMOOTHING_ORDER, SMOOTHING_TYPE, MIN_APPROACH, HANDLE_MODE, VIEW_MODE } from './lib/uiConstants';

  const DEFAULT_PARAMS = {
    smoothingType: SMOOTHING_TYPE.EMA,
    emaSmoothing: 0,
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
  let liveOutputPressure = null;
  let showDriverWarning = true;
  let leftPanelsCollapsed = false;
  let viewMode = VIEW_MODE.CANVAS;
  // Owned here because the loader lives in the right pane's toolbar while the
  // curve panel needs the same data for its indicators.
  let pressureResponseData = null;
  let showResponseCurveEffect = true;
  let showRawIndicator = true;
  let showEffectiveIndicator = true;
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
  <PressureChart
    bind:params
    bind:showRawIndicator
    bind:showEffectiveIndicator
    {livePressure}
    {liveRawPressure}
    {liveOutputPressure}
    defaultParams={DEFAULT_PARAMS}
  />

  <!-- Sits on the seam it moves, and in its own grid column so it survives
       the collapse and can bring the panel back. -->
  <button
    class="panel-rail"
    type="button"
    aria-expanded={!leftPanelsCollapsed}
    aria-label={leftPanelsCollapsed ? 'Show panel' : 'Hide panel'}
    title={leftPanelsCollapsed ? 'Show panel' : 'Hide panel'}
    on:click={() => leftPanelsCollapsed = !leftPanelsCollapsed}
  >{leftPanelsCollapsed ? '›' : '‹'}</button>

  <ViewPanel
    bind:livePressure
    bind:liveRawPressure
    bind:liveOutputPressure
    bind:viewMode
    {params}
    {showRawIndicator}
    {showEffectiveIndicator}
    responseData={pressureResponseData}
    {showResponseCurveEffect}
    onResponseDataChange={(data) => pressureResponseData = data}
    onResponseShowCurveEffectChange={(value) => showResponseCurveEffect = value}
  />
</div>
