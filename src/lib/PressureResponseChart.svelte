<script>
  import { onMount } from 'svelte';
  import { applyPressureCurve } from './curveMath';
  import { PAD_LEFT, PAD_TOP, PAD_RIGHT, PAD_BOTTOM } from './canvasConstants';
  import { drawBackground, drawGrid, drawLabels } from './canvasUtils';

  const RESPONSE_COLOR = '#000000';

  export let data = null;
  export let params = null;
  export let showCurveEffect = true;
  export let liveRawPressure = null;
  export let livePressure = null;
  export let liveOutputPressure = null;
  export let showRawIndicator = true;
  export let showEffectiveIndicator = true;
  // When true the chart fills its container in both dimensions instead of
  // taking its height from a fixed aspect ratio. Used by the full-pane view.
  export let fill = false;

  let canvasEl;
  let ctx;
  let containerEl;
  let canvasHostEl;
  let dpr = 1;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastDpr = 0;
  let isReady = false;

  $: if (isReady) {
    data;
    params;
    showCurveEffect;
    liveRawPressure;
    livePressure;
    liveOutputPressure;
    showRawIndicator;
    showEffectiveIndicator;
    draw();
  }

  function layout() {
    const width = canvasEl.width / dpr;
    const height = canvasEl.height / dpr;
    return {
      width,
      height,
      plotW: width - PAD_LEFT - PAD_RIGHT,
      plotH: height - PAD_TOP - PAD_BOTTOM,
    };
  }

  function draw() {
    if (!canvasEl || !ctx || canvasEl.width === 0) return;

    const { width, height, plotW, plotH } = layout();

    const records = data?.records ?? [];
    const maxGf = records.length ? Math.max(...records.map((r) => r[0])) : 1;

    drawBackground(ctx, width, height, plotW, plotH);
    drawGrid(ctx, plotW, plotH);
    drawLabels(ctx, width, height, plotW, plotH, {
      xAxisLabel: 'PHYSICAL (gf)',
      yAxisLabel: showCurveEffect && params ? 'OUTPUT %' : 'LOGICAL %',
      formatXLabel: (i) => {
        const gfValue = (i / 4) * maxGf;
        return Number.isInteger(gfValue) ? String(gfValue) : gfValue.toFixed(1);
      },
      formatYLabel: (i) => (i * 25).toFixed(0),
    });

    function findCxForY(yNorm) {
      for (let i = 0; i < records.length - 1; i++) {
        const y0 = getY(records[i][1]);
        const y1 = getY(records[i + 1][1]);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);
        if (yNorm >= minY && yNorm <= maxY) {
          const t = (y1 !== y0) ? (yNorm - y0) / (y1 - y0) : 0;
          const gf = records[i][0] + t * (records[i + 1][0] - records[i][0]);
          return PAD_LEFT + (gf / maxGf) * plotW;
        }
      }
      const firstY = getY(records[0][1]);
      const lastY = getY(records[records.length - 1][1]);
      const nearFirst = Math.abs(yNorm - firstY) <= Math.abs(yNorm - lastY);
      return nearFirst
        ? PAD_LEFT + (records[0][0] / maxGf) * plotW
        : PAD_LEFT + (records[records.length - 1][0] / maxGf) * plotW;
    }

    function drawIndicator(yNorm, solidColor, fadedColor) {
      const cx = findCxForY(yNorm);
      const cy = PAD_TOP + plotH - yNorm * plotH;
      ctx.strokeStyle = fadedColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, cy);
      ctx.lineTo(cx, cy);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, PAD_TOP + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = solidColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!records.length || maxGf === 0) return;

    const getY = (logPct) => {
      if (showCurveEffect && params) {
        return applyPressureCurve(logPct / 100, params);
      }
      return logPct / 100;
    };

    // Connecting line
    ctx.strokeStyle = RESPONSE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    let first = true;
    for (const [gf, logPct] of records) {
      const cx = PAD_LEFT + (gf / maxGf) * plotW;
      const cy = PAD_TOP + plotH - getY(logPct) * plotH;
      if (first) { ctx.moveTo(cx, cy); first = false; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Data points
    ctx.fillStyle = RESPONSE_COLOR;
    for (const [gf, logPct] of records) {
      const cx = PAD_LEFT + (gf / maxGf) * plotW;
      const cy = PAD_TOP + plotH - getY(logPct) * plotH;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (showRawIndicator && liveRawPressure !== null) {
      const yNorm = (showCurveEffect && params)
        ? applyPressureCurve(liveRawPressure, params)
        : liveRawPressure;
      drawIndicator(yNorm, '#8833cc', 'rgba(136, 51, 204, 0.25)');
    }

    if (showEffectiveIndicator && livePressure !== null) {
      // When the Y axis shows OUTPUT %, use the pressure that actually drives
      // the brush; on the LOGICAL % axis the pre-curve value is the right one.
      const yNorm = (showCurveEffect && params)
        ? (liveOutputPressure ?? applyPressureCurve(livePressure, params))
        : livePressure;
      drawIndicator(yNorm, '#14a050', 'rgba(20, 160, 80, 0.25)');
    }
  }

  function resize() {
    if (!canvasEl || !containerEl || !ctx) return;

    // While the curve panel is collapsed the container has no layout box;
    // skip so the cached size survives and expanding restores it as-is.
    if (containerEl.clientWidth === 0) return;

    // In fill mode the canvas host is a flex child that already owns the
    // leftover height, so measure it rather than deriving from an aspect ratio.
    const width = Math.max(120, (fill ? canvasHostEl.clientWidth : containerEl.clientWidth - 24));
    const height = fill
      ? Math.max(120, canvasHostEl.clientHeight)
      : Math.round(width * 0.6);
    dpr = window.devicePixelRatio || 1;

    if (width === lastWidth && height === lastHeight && dpr === lastDpr && canvasEl.width > 0) {
      draw();
      return;
    }

    lastWidth = width;
    lastHeight = height;
    lastDpr = dpr;
    canvasEl.style.width = `${width}px`;
    canvasEl.style.height = `${height}px`;
    canvasEl.width = Math.round(width * dpr);
    canvasEl.height = Math.round(height * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    draw();
  }

  onMount(() => {
    ctx = canvasEl.getContext('2d');
    const observer = new ResizeObserver(resize);
    observer.observe(containerEl);
    if (canvasHostEl) observer.observe(canvasHostEl);
    resize();
    isReady = true;
    return () => observer.disconnect();
  });
</script>

<div class="response-chart-wrap" class:fill bind:this={containerEl}>
  {#if data}
    <div class="response-chart-title">
      <span class="response-chart-id">{data.inventoryid}</span>
      <span class="response-chart-meta">{data.brand} {data.pen} · {data.tablet} · {data.date}</span>
    </div>
  {/if}
  <div class="response-canvas-host" bind:this={canvasHostEl}>
    <canvas bind:this={canvasEl}></canvas>
  </div>
</div>

<style>
  .response-chart-wrap {
    margin-top: 8px;
  }

  .response-canvas-host {
    min-width: 0;
  }

  .response-chart-wrap.fill .response-canvas-host {
    flex: 1;
    min-height: 0;
  }

  .response-chart-wrap.fill {
    margin-top: 0;
    padding: 8px 12px 12px;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .response-chart-title {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 2px;
    padding-left: 2px;
  }

  .response-chart-id {
    font-size: 12px;
    font-weight: bold;
    color: #cc6600;
  }

  .response-chart-meta {
    font-size: 12px;
    color: #999;
  }

  canvas {
    display: block;
  }
</style>
