<script>
  import { onMount } from 'svelte';
  import PressureChart from './lib/PressureChart.svelte';
  import DrawingCanvas from './lib/DrawingCanvas.svelte';

  const DEFAULT_PARAMS = {
    softness: 0.0,
    inputMinimum: 0,
    inputMaximum: 1,
    minimum: 0,
    maximum: 1,
    curveType: 'power',
    transitionWidth: 0,
    flatLevel: 0.5,
  };

  let params = { ...DEFAULT_PARAMS };
  let livePressure = null;
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
  <PressureChart bind:params {livePressure} defaultParams={DEFAULT_PARAMS} />
  <DrawingCanvas bind:livePressure {params} />
</div>
