<script>
  import { onMount } from 'svelte';

  const PAD_LEFT = 42;
  const PAD_BOTTOM = 32;
  const PAD_TOP = 20;
  const PAD_RIGHT = 20;
  const X_LABEL_SPACING = 8;
  const Y_LABEL_SPACING = 8;
  const X_AXIS_LABEL_SPACING = 2;
  const Y_AXIS_LABEL_SPACING = 7;

  const RESPONSE_COLOR = '#cc6600';

  export let data = null;

  let canvasEl;
  let ctx;
  let containerEl;
  let dpr = 1;
  let lastSize = 0;
  let isReady = false;

  $: if (isReady) {
    data;
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

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#f7f7fb';
    ctx.fillRect(PAD_LEFT, PAD_TOP, plotW, plotH);

    // Grid
    ctx.strokeStyle = '#ebebf4';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const gx = PAD_LEFT + (i / 4) * plotW;
      const gy = PAD_TOP + (i / 4) * plotH;

      ctx.beginPath();
      ctx.moveTo(gx, PAD_TOP);
      ctx.lineTo(gx, PAD_TOP + plotH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, gy);
      ctx.lineTo(PAD_LEFT + plotW, gy);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#000000';
    ctx.font = '9px Consolas, monospace';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i += 1) {
      const gx = PAD_LEFT + (i / 4) * plotW;
      const gfValue = (i / 4) * maxGf;
      const label = Number.isInteger(gfValue) ? String(gfValue) : gfValue.toFixed(1);
      ctx.fillText(label, gx, PAD_TOP + plotH + X_LABEL_SPACING);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i += 1) {
      const gy = PAD_TOP + plotH - (i / 4) * plotH;
      const label = (i * 25).toFixed(0);
      ctx.fillText(label, PAD_LEFT - Y_LABEL_SPACING, gy);
    }

    ctx.fillStyle = '#000000';
    ctx.font = '9px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('PHYSICAL (gf)', PAD_LEFT + plotW / 2, height - X_AXIS_LABEL_SPACING);

    ctx.save();
    ctx.translate(Y_AXIS_LABEL_SPACING, PAD_TOP + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('LOGICAL %', 0, 0);
    ctx.restore();

    if (!records.length || maxGf === 0) return;

    // Connecting line
    ctx.strokeStyle = RESPONSE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    let first = true;
    for (const [gf, logPct] of records) {
      const cx = PAD_LEFT + (gf / maxGf) * plotW;
      const cy = PAD_TOP + plotH - (logPct / 100) * plotH;
      if (first) { ctx.moveTo(cx, cy); first = false; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Data points
    ctx.fillStyle = RESPONSE_COLOR;
    for (const [gf, logPct] of records) {
      const cx = PAD_LEFT + (gf / maxGf) * plotW;
      const cy = PAD_TOP + plotH - (logPct / 100) * plotH;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

  }

  function resize() {
    if (!canvasEl || !containerEl || !ctx) return;

    const size = Math.max(120, containerEl.clientWidth - 24);
    dpr = window.devicePixelRatio || 1;

    if (size === lastSize && canvasEl.width > 0) {
      draw();
      return;
    }

    lastSize = size;
    canvasEl.style.width = `${size}px`;
    canvasEl.style.height = `${Math.round(size * 0.6)}px`;
    canvasEl.width = Math.round(size * dpr);
    canvasEl.height = Math.round(size * 0.6 * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    draw();
  }

  onMount(() => {
    ctx = canvasEl.getContext('2d');
    const observer = new ResizeObserver(resize);
    observer.observe(containerEl);
    resize();
    isReady = true;
    return () => observer.disconnect();
  });
</script>

<div class="response-chart-wrap" bind:this={containerEl}>
  {#if data}
    <div class="response-chart-title">
      <span class="response-chart-id">{data.inventoryid}</span>
      <span class="response-chart-meta">{data.brand} {data.pen} · {data.tablet} · {data.date}</span>
    </div>
  {/if}
  <canvas bind:this={canvasEl}></canvas>
</div>

<style>
  .response-chart-wrap {
    margin-top: 8px;
  }

  .response-chart-title {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 2px;
    padding-left: 2px;
  }

  .response-chart-id {
    font-size: 11px;
    font-weight: bold;
    color: #cc6600;
  }

  .response-chart-meta {
    font-size: 10px;
    color: #999;
  }

  canvas {
    display: block;
  }
</style>
