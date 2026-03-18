<script>
  import { onMount } from 'svelte';
  import PressureChart from './lib/PressureChart.svelte';
  import DrawingCanvas from './lib/DrawingCanvas.svelte';

  const DEFAULT_PARAMS = {
    emaSmoothing: 0,
    positionEmaSmoothing: 0,
    smoothingOrder: 'smooth-then-curve',
    softness: 0.0,
    inputMinimum: 0,
    inputMaximum: 1,
    minimum: 0,
    maximum: 1,
    curveType: 'power',
    transitionWidth: 0,
    flatLevel: 0.5,
    customPoints: [
      {
        x: 0,
        y: 0,
        inX: 0,
        inY: 0,
        outX: 0.33,
        outY: 0,
        handleMode: 'broken',
      },
      {
        x: 1,
        y: 1,
        inX: 0.67,
        inY: 1,
        outX: 1,
        outY: 1,
        handleMode: 'broken',
      },
    ],
  };

  let params = { ...DEFAULT_PARAMS };
  let livePressure = null;
  let liveRawPressure = null;
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

<div id="layout">
  <PressureChart bind:params {livePressure} {liveRawPressure} defaultParams={DEFAULT_PARAMS} />
  <DrawingCanvas bind:livePressure bind:liveRawPressure {params} />
</div>
