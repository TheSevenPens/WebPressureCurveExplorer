<script>
  import { onMount } from 'svelte';
  import { applyPressureCurve } from './curveMath';
  import PressureChartFormat from './PressureChartFormat.svelte';
  import PressureCurveControls from './PressureCurveControls.svelte';

  const PAD_LEFT = 42;
  const PAD_BOTTOM = 32;
  const PAD_TOP = 20;
  const PAD_RIGHT = 20;
  const X_LABEL_SPACING = 8;
  const Y_LABEL_SPACING = 8;
  const X_AXIS_LABEL_SPACING = 2;
  const Y_AXIS_LABEL_SPACING = 7;

  const CURVE_COLOR = '#000000';
  const MIN_CONTROL_NODE_COLOR = 'rgb(255, 0, 136)';
  const MIN_CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';
  const MAX_CONTROL_NODE_COLOR = '#00d0ff';
  const MAX_CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';

  const NODE_RADIUS = 8;
  const HANDLE_RADIUS = 5;

  export let params;
  export let livePressure = null;
  export let defaultParams;

  let pressureResponseData = null;

  function onResponseDataChange(data) {
    pressureResponseData = data;
  }

  let showGrid = true;
  let showLabels = true;
  let showNodes = true;
  let showNodeGuides = true;

  let menuCopyOpen = false;
  let menuSaveOpen = false;
  let customContextMenuOpen = false;
  let customContextMenuX = 0;
  let customContextMenuY = 0;
  let customContextValueX = null;
  let customContextValueY = null;
  let customContextPointIndex = null;
  let copyButtonLabel = 'Copy ▾';

  let curvePanelEl;
  let curveCanvasEl;
  let curveCtx;
  let resizeObserver;
  let curveDpr = 1;
  let lastCurveSize = 0;
  let draggingNode = null;
  let selectedCustomPoint = null;
  let selectedCustomHandle = null;
  let isReady = false;

  $: curveActive = params.curveType === 'power' || params.curveType === 'sigmoid';
  $: flatActive = params.curveType === 'flat';
  $: customActive = params.curveType === 'custom';
  $: customPoints = sanitizeCustomPoints(params.customPoints);
  $: canAddCustomPoint = customActive && customPoints.length < 16;
  $: canRemoveCustomPoint = customActive && customPoints.length > 2;

  $: if (isReady) {
    params;
    livePressure;
    showGrid;
    showLabels;
    showNodes;
    showNodeGuides;
    pressureResponseData;
    drawCurveCanvas();
  }

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }

  function sanitizeCustomPoints(points) {
    const source = Array.isArray(points) && points.length > 0
      ? points
      : [{ x: 0, y: 0 }, { x: 1, y: 1 }];

    const normalized = source
      .map((point) => ({
        x: Number(point?.x ?? 0),
        y: Number(point?.y ?? 0),
        inX: Number(point?.inX ?? point?.x ?? 0),
        inY: Number(point?.inY ?? point?.y ?? 0),
        outX: Number(point?.outX ?? point?.x ?? 0),
        outY: Number(point?.outY ?? point?.y ?? 0),
        handleMode: point?.handleMode === 'mirrored' ? 'mirrored' : 'broken',
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .map((point) => ({
        x: Math.min(1, Math.max(0, point.x)),
        y: Math.min(1, Math.max(0, point.y)),
        inX: Number.isFinite(point.inX) ? Math.min(1, Math.max(0, point.inX)) : Math.min(1, Math.max(0, point.x)),
        inY: Number.isFinite(point.inY) ? Math.min(1, Math.max(0, point.inY)) : Math.min(1, Math.max(0, point.y)),
        outX: Number.isFinite(point.outX) ? Math.min(1, Math.max(0, point.outX)) : Math.min(1, Math.max(0, point.x)),
        outY: Number.isFinite(point.outY) ? Math.min(1, Math.max(0, point.outY)) : Math.min(1, Math.max(0, point.y)),
        handleMode: point.handleMode,
      }))
      .sort((a, b) => a.x - b.x);

    if (normalized.length === 0) {
      return [
        { x: 0, y: 0, inX: 0, inY: 0, outX: 0.33, outY: 0, handleMode: 'broken' },
        { x: 1, y: 1, inX: 0.67, inY: 1, outX: 1, outY: 1, handleMode: 'broken' },
      ];
    }

    if (normalized[0].x > 0) {
      normalized.unshift({
        x: 0,
        y: normalized[0].y,
        inX: 0,
        inY: normalized[0].y,
        outX: Math.min(1, normalized[0].x / 2),
        outY: normalized[0].y,
        handleMode: 'broken',
      });
    } else {
      normalized[0] = { ...normalized[0], x: 0 };
    }

    const lastIndex = normalized.length - 1;
    if (normalized[lastIndex].x < 1) {
      normalized.push({
        x: 1,
        y: normalized[lastIndex].y,
        inX: Math.max(0, (normalized[lastIndex].x + 1) / 2),
        inY: normalized[lastIndex].y,
        outX: 1,
        outY: normalized[lastIndex].y,
        handleMode: 'broken',
      });
    } else {
      normalized[lastIndex] = { ...normalized[lastIndex], x: 1 };
    }

    for (let i = 0; i < normalized.length; i += 1) {
      const point = normalized[i];
      const prevX = i > 0 ? normalized[i - 1].x : point.x;
      const nextX = i < normalized.length - 1 ? normalized[i + 1].x : point.x;
      point.inX = Math.max(prevX, Math.min(point.x, point.inX));
      point.outX = Math.max(point.x, Math.min(nextX, point.outX));
      point.inY = Math.min(1, Math.max(0, point.inY));
      point.outY = Math.min(1, Math.max(0, point.outY));
      point.handleMode = point.handleMode === 'mirrored' ? 'mirrored' : 'broken';
    }

    normalized[0].inX = normalized[0].x;
    normalized[0].inY = normalized[0].y;
    normalized[0].handleMode = 'broken';
    normalized[lastIndex].outX = normalized[lastIndex].x;
    normalized[lastIndex].outY = normalized[lastIndex].y;
    normalized[lastIndex].handleMode = 'broken';

    return normalized;
  }

  function isRemovableCustomPoint(index) {
    return index !== null && index > 0 && index < customPoints.length - 1;
  }

  function updateCustomPoints(nextPoints) {
    patchParams({ customPoints: sanitizeCustomPoints(nextPoints) });
  }

  function customPointCenter(index) {
    const { plotW, plotH } = curveLayout();
    const point = customPoints[index];
    if (!point) return null;
    return {
      x: PAD_LEFT + point.x * plotW,
      y: PAD_TOP + plotH - point.y * plotH,
    };
  }

  function hitTestCustomPoint(cssX, cssY) {
    for (let i = customPoints.length - 1; i >= 0; i -= 1) {
      const center = customPointCenter(i);
      if (!center) continue;
      const dx = cssX - center.x;
      const dy = cssY - center.y;
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS) return i;
    }
    return null;
  }

  function customHandleCenter(index, handle) {
    const { plotW, plotH } = curveLayout();
    const point = customPoints[index];
    if (!point) return null;

    const xValue = handle === 'in' ? point.inX : point.outX;
    const yValue = handle === 'in' ? point.inY : point.outY;
    return {
      x: PAD_LEFT + xValue * plotW,
      y: PAD_TOP + plotH - yValue * plotH,
    };
  }

  function hitTestCustomHandle(cssX, cssY) {
    for (let i = customPoints.length - 1; i >= 0; i -= 1) {
      const point = customPoints[i];
      const handles = [];
      if (i > 0 && (point.inX !== point.x || point.inY !== point.y)) {
        handles.push('in');
      }
      if (i < customPoints.length - 1 && (point.outX !== point.x || point.outY !== point.y)) {
        handles.push('out');
      }

      for (const handle of handles) {
        const center = customHandleCenter(i, handle);
        if (!center) continue;
        const dx = cssX - center.x;
        const dy = cssY - center.y;
        if (Math.sqrt(dx * dx + dy * dy) <= HANDLE_RADIUS + 1) {
          return { index: i, handle };
        }
      }
    }

    return null;
  }

  function addCustomPoint() {
    if (!canAddCustomPoint) return;

    let targetIndex = 0;
    let maxGap = -1;
    for (let i = 0; i < customPoints.length - 1; i += 1) {
      const gap = customPoints[i + 1].x - customPoints[i].x;
      if (gap > maxGap) {
        maxGap = gap;
        targetIndex = i;
      }
    }

    const left = customPoints[targetIndex];
    const right = customPoints[targetIndex + 1];
    const newPoint = {
      x: Math.round(((left.x + right.x) / 2) * 100) / 100,
      y: Math.round(((left.y + right.y) / 2) * 100) / 100,
      inX: Math.round(((left.x * 0.66 + right.x * 0.34)) * 100) / 100,
      inY: Math.round(((left.y * 0.66 + right.y * 0.34)) * 100) / 100,
      outX: Math.round(((left.x * 0.34 + right.x * 0.66)) * 100) / 100,
      outY: Math.round(((left.y * 0.34 + right.y * 0.66)) * 100) / 100,
      handleMode: 'broken',
    };

    const next = [...customPoints];
    next.splice(targetIndex + 1, 0, newPoint);
    updateCustomPoints(next);
    selectedCustomPoint = targetIndex + 1;
  }

  function removeCustomPoint() {
    if (!canRemoveCustomPoint) return;

    const isRemovableSelection = isRemovableCustomPoint(selectedCustomPoint);
    const removeIndex = isRemovableSelection ? selectedCustomPoint : customPoints.length - 2;

    const next = [...customPoints];
    next.splice(removeIndex, 1);
    updateCustomPoints(next);
    selectedCustomPoint = null;
    selectedCustomHandle = null;
  }

  function curveLayout() {
    const width = curveCanvasEl.width / curveDpr;
    const height = curveCanvasEl.height / curveDpr;
    return {
      plotW: width - PAD_LEFT - PAD_RIGHT,
      plotH: height - PAD_TOP - PAD_BOTTOM,
    };
  }

  function nodeCenter(key) {
    const { plotW, plotH } = curveLayout();
    if (key === 'a') {
      return {
        x: PAD_LEFT + params.inputMinimum * plotW,
        y: PAD_TOP + plotH - params.minimum * plotH,
      };
    }
    return {
      x: PAD_LEFT + params.inputMaximum * plotW,
      y: PAD_TOP + plotH - params.maximum * plotH,
    };
  }

  function hitTestCurveNode(cssX, cssY) {
    for (const key of ['a', 'b']) {
      const center = nodeCenter(key);
      const dx = cssX - center.x;
      const dy = cssY - center.y;
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS) return key;
    }
    return null;
  }

  function valueFromCurveX(cssX) {
    const { plotW } = curveLayout();
    return Math.min(1, Math.max(0, (cssX - PAD_LEFT) / plotW));
  }

  function valueFromCurveY(cssY) {
    const { plotH } = curveLayout();
    return Math.min(1, Math.max(0, (PAD_TOP + plotH - cssY) / plotH));
  }

  function isInsidePlotArea(cssX, cssY) {
    const { plotW, plotH } = curveLayout();
    return cssX >= PAD_LEFT
      && cssX <= PAD_LEFT + plotW
      && cssY >= PAD_TOP
      && cssY <= PAD_TOP + plotH;
  }

  function insertCustomPointAt(cssX, cssY) {
    if (!canAddCustomPoint || !isInsidePlotArea(cssX, cssY)) return null;

    const rawX = valueFromCurveX(cssX);
    const rawY = valueFromCurveY(cssY);
    let insertIndex = customPoints.findIndex((point) => point.x > rawX);

    if (insertIndex <= 0) {
      insertIndex = 1;
    } else if (insertIndex === -1) {
      insertIndex = customPoints.length - 1;
    }

    const prevX = customPoints[insertIndex - 1].x;
    const nextX = customPoints[insertIndex].x;
    const minX = prevX + 0.01;
    const maxX = nextX - 0.01;
    if (minX > maxX) return null;

    let x = Math.min(maxX, Math.max(minX, rawX));
    x = Math.round(x * 100) / 100;
    x = Math.min(maxX, Math.max(minX, x));

    const y = Math.round(rawY * 100) / 100;

    const next = [...customPoints];
    next.splice(insertIndex, 0, {
      x,
      y,
      inX: Math.round((prevX + x) * 50) / 100,
      inY: y,
      outX: Math.round((x + nextX) * 50) / 100,
      outY: y,
      handleMode: 'broken',
    });
    updateCustomPoints(next);
    selectedCustomPoint = insertIndex;
    return insertIndex;
  }

  function openCustomContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!customActive) {
      closeMenus();
      return;
    }

    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const hitIndex = hitTestCustomPoint(cssX, cssY);
    const insidePlot = isInsidePlotArea(cssX, cssY);
    const canAddAtLocation = canAddCustomPoint && insidePlot;
    const canRemoveAtPoint = isRemovableCustomPoint(hitIndex);

    if (!canAddAtLocation && !canRemoveAtPoint) {
      closeMenus();
      return;
    }

    customContextMenuOpen = true;
    customContextMenuX = event.clientX;
    customContextMenuY = event.clientY;
    customContextValueX = canAddAtLocation ? valueFromCurveX(cssX) : null;
    customContextValueY = canAddAtLocation ? valueFromCurveY(cssY) : null;
    customContextPointIndex = hitIndex;
    if (hitIndex !== null) {
      selectedCustomPoint = hitIndex;
    }
    menuCopyOpen = false;
    menuSaveOpen = false;
  }

  function addCustomPointFromContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (customContextValueX === null || customContextValueY === null) {
      closeMenus();
      return;
    }

    const { plotW, plotH } = curveLayout();
    const cssX = PAD_LEFT + customContextValueX * plotW;
    const cssY = PAD_TOP + plotH - customContextValueY * plotH;
    const insertedIndex = insertCustomPointAt(cssX, cssY);
    if (insertedIndex !== null) {
      selectedCustomPoint = insertedIndex;
    }

    closeMenus();
  }

  function removeCustomPointFromContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isRemovableCustomPoint(customContextPointIndex)) {
      closeMenus();
      return;
    }

    selectedCustomPoint = customContextPointIndex;
    removeCustomPoint();
    closeMenus();
  }

  function setCustomPointHandleModeFromContextMenu(mode, event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isRemovableCustomPoint(customContextPointIndex)) {
      closeMenus();
      return;
    }

    const next = [...customPoints];
    next[customContextPointIndex] = {
      ...next[customContextPointIndex],
      handleMode: mode === 'mirrored' ? 'mirrored' : 'broken',
    };

    updateCustomPoints(next);
    closeMenus();
  }

  function resizeCurveCanvas() {
    if (!curveCanvasEl || !curvePanelEl || !curveCtx) return;

    const size = Math.max(160, curvePanelEl.clientWidth - 24);
    curveDpr = window.devicePixelRatio || 1;

    if (size === lastCurveSize && curveCanvasEl.width > 0) {
      drawCurveCanvas();
      return;
    }

    lastCurveSize = size;
    curveCanvasEl.style.width = `${size}px`;
    curveCanvasEl.style.height = `${size}px`;
    curveCanvasEl.width = Math.round(size * curveDpr);
    curveCanvasEl.height = Math.round(size * curveDpr);

    curveCtx.setTransform(1, 0, 0, 1, 0, 0);
    curveCtx.scale(curveDpr, curveDpr);
    drawCurveCanvas();
  }

  function drawResponseOverlay(plotW, plotH) {
    if (!pressureResponseData?.records?.length) return;

    const records = pressureResponseData.records;
    const maxGf = Math.max(...records.map((r) => r[0]));
    if (maxGf === 0) return;

    const COLOR = '#cc6600';

    curveCtx.save();
    curveCtx.globalAlpha = 0.75;

    // Connecting line
    curveCtx.strokeStyle = COLOR;
    curveCtx.lineWidth = 1.5;
    curveCtx.setLineDash([]);
    curveCtx.beginPath();
    let first = true;
    for (const [gf, logPct] of records) {
      const cx = PAD_LEFT + (gf / maxGf) * plotW;
      const cy = PAD_TOP + plotH - (logPct / 100) * plotH;
      if (first) { curveCtx.moveTo(cx, cy); first = false; }
      else curveCtx.lineTo(cx, cy);
    }
    curveCtx.stroke();

    // Data points
    curveCtx.fillStyle = COLOR;
    for (const [gf, logPct] of records) {
      const cx = PAD_LEFT + (gf / maxGf) * plotW;
      const cy = PAD_TOP + plotH - (logPct / 100) * plotH;
      curveCtx.beginPath();
      curveCtx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      curveCtx.fill();
    }

    // Legend label
    curveCtx.globalAlpha = 0.9;
    curveCtx.fillStyle = COLOR;
    curveCtx.font = '9px Consolas, monospace';
    curveCtx.textAlign = 'right';
    curveCtx.textBaseline = 'top';
    const label = pressureResponseData.inventoryid
      ? `${pressureResponseData.inventoryid} phys.response`
      : 'phys.response';
    curveCtx.fillText(label, PAD_LEFT + plotW - 2, PAD_TOP + 3);

    curveCtx.restore();
  }

  function drawCurveCanvas() {
    if (!curveCanvasEl || !curveCtx || curveCanvasEl.width === 0) return;

    const width = curveCanvasEl.width / curveDpr;
    const height = curveCanvasEl.height / curveDpr;
    const plotW = width - PAD_LEFT - PAD_RIGHT;
    const plotH = height - PAD_TOP - PAD_BOTTOM;

    curveCtx.fillStyle = '#ffffff';
    curveCtx.fillRect(0, 0, width, height);
    curveCtx.fillStyle = '#f7f7fb';
    curveCtx.fillRect(PAD_LEFT, PAD_TOP, plotW, plotH);

    if (showGrid) {
      curveCtx.strokeStyle = '#ebebf4';
      curveCtx.lineWidth = 1;
      for (let i = 0; i <= 4; i += 1) {
        const gx = PAD_LEFT + (i / 4) * plotW;
        const gy = PAD_TOP + (i / 4) * plotH;

        curveCtx.beginPath();
        curveCtx.moveTo(gx, PAD_TOP);
        curveCtx.lineTo(gx, PAD_TOP + plotH);
        curveCtx.stroke();

        curveCtx.beginPath();
        curveCtx.moveTo(PAD_LEFT, gy);
        curveCtx.lineTo(PAD_LEFT + plotW, gy);
        curveCtx.stroke();
      }
    }

    if (showLabels) {
      curveCtx.fillStyle = '#000000';
      curveCtx.font = '9px Consolas, monospace';

      curveCtx.textAlign = 'center';
      curveCtx.textBaseline = 'top';
      for (let i = 0; i <= 4; i += 1) {
        const gx = PAD_LEFT + (i / 4) * plotW;
        const label = (i * 0.25).toFixed(2).replace(/\.?0+$/, '');
        curveCtx.fillText(label, gx, PAD_TOP + plotH + X_LABEL_SPACING);
      }

      curveCtx.textAlign = 'right';
      curveCtx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i += 1) {
        const gy = PAD_TOP + plotH - (i / 4) * plotH;
        const label = (i * 0.25).toFixed(2).replace(/\.?0+$/, '');
        curveCtx.fillText(label, PAD_LEFT - Y_LABEL_SPACING, gy);
      }

      curveCtx.fillStyle = '#000000';
      curveCtx.font = '9px Segoe UI, sans-serif';
      curveCtx.textAlign = 'center';
      curveCtx.textBaseline = 'bottom';
      curveCtx.fillText('INPUT', PAD_LEFT + plotW / 2, height - X_AXIS_LABEL_SPACING);

      curveCtx.save();
      curveCtx.translate(Y_AXIS_LABEL_SPACING, PAD_TOP + plotH / 2);
      curveCtx.rotate(-Math.PI / 2);
      curveCtx.textAlign = 'center';
      curveCtx.textBaseline = 'top';
      curveCtx.fillText('OUTPUT', 0, 0);
      curveCtx.restore();
    }

    curveCtx.lineWidth = 2;
    curveCtx.lineJoin = 'round';

    if (params.curveType === 'null-effect') {
      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT, PAD_TOP + plotH);
      curveCtx.lineTo(PAD_LEFT + plotW, PAD_TOP);
      curveCtx.stroke();
    } else if (params.curveType === 'flat') {
      const fy = PAD_TOP + plotH - params.flatLevel * plotH;
      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT, fy);
      curveCtx.lineTo(PAD_LEFT + plotW, fy);
      curveCtx.stroke();
    } else if (customActive) {
      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      if (customPoints.length > 0) {
        const first = customPoints[0];
        curveCtx.moveTo(PAD_LEFT + first.x * plotW, PAD_TOP + plotH - first.y * plotH);

        for (let i = 0; i < customPoints.length - 1; i += 1) {
          const a = customPoints[i];
          const b = customPoints[i + 1];
          curveCtx.bezierCurveTo(
            PAD_LEFT + a.outX * plotW,
            PAD_TOP + plotH - a.outY * plotH,
            PAD_LEFT + b.inX * plotW,
            PAD_TOP + plotH - b.inY * plotH,
            PAD_LEFT + b.x * plotW,
            PAD_TOP + plotH - b.y * plotH,
          );
        }
      }
      curveCtx.stroke();

      if (showNodes) {
        for (let i = 0; i < customPoints.length; i += 1) {
          const point = customPoints[i];
          const nodeX = PAD_LEFT + point.x * plotW;
          const nodeY = PAD_TOP + plotH - point.y * plotH;
          const isEndpoint = i === 0 || i === customPoints.length - 1;
          const isSelected = i === selectedCustomPoint;

          if (showNodeGuides) {
            if (i > 0) {
              const inX = PAD_LEFT + point.inX * plotW;
              const inY = PAD_TOP + plotH - point.inY * plotH;
              curveCtx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
              curveCtx.lineWidth = 1;
              curveCtx.setLineDash([]);
              curveCtx.beginPath();
              curveCtx.moveTo(nodeX, nodeY);
              curveCtx.lineTo(inX, inY);
              curveCtx.stroke();

              curveCtx.fillStyle = i === selectedCustomPoint && selectedCustomHandle === 'in'
                ? '#111111'
                : '#ffffff';
              curveCtx.strokeStyle = '#2255cc';
              curveCtx.lineWidth = 1.3;
              curveCtx.beginPath();
              curveCtx.arc(inX, inY, HANDLE_RADIUS, 0, Math.PI * 2);
              curveCtx.fill();
              curveCtx.stroke();
            }

            if (i < customPoints.length - 1) {
              const outX = PAD_LEFT + point.outX * plotW;
              const outY = PAD_TOP + plotH - point.outY * plotH;
              curveCtx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
              curveCtx.lineWidth = 1;
              curveCtx.setLineDash([]);
              curveCtx.beginPath();
              curveCtx.moveTo(nodeX, nodeY);
              curveCtx.lineTo(outX, outY);
              curveCtx.stroke();

              curveCtx.fillStyle = i === selectedCustomPoint && selectedCustomHandle === 'out'
                ? '#111111'
                : '#ffffff';
              curveCtx.strokeStyle = '#2255cc';
              curveCtx.lineWidth = 1.3;
              curveCtx.beginPath();
              curveCtx.arc(outX, outY, HANDLE_RADIUS, 0, Math.PI * 2);
              curveCtx.fill();
              curveCtx.stroke();
            }
          }

          curveCtx.fillStyle = isEndpoint ? '#7a7a8b' : '#2255cc';
          curveCtx.beginPath();
          curveCtx.arc(nodeX, nodeY, 6, 0, Math.PI * 2);
          curveCtx.fill();

          curveCtx.strokeStyle = isSelected ? '#111111' : '#ffffff';
          curveCtx.lineWidth = isSelected ? 2.2 : 1.5;
          curveCtx.stroke();
        }
      }
    } else {
      const inMin = params.inputMinimum;
      const inMax = params.inputMaximum;
      const outMin = params.minimum;
      const outMax = params.maximum;

      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT, PAD_TOP + plotH - outMin * plotH);
      curveCtx.lineTo(PAD_LEFT + inMin * plotW, PAD_TOP + plotH - outMin * plotH);
      curveCtx.stroke();

      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      const pxStart = Math.round(inMin * plotW);
      const pxEnd = Math.round(inMax * plotW);
      let first = true;
      for (let px = pxStart; px <= pxEnd; px += 1) {
        const x = px / plotW;
        const y = applyPressureCurve(x, params);
        const cx = PAD_LEFT + px;
        const cy = PAD_TOP + plotH - y * plotH;
        if (first) {
          curveCtx.moveTo(cx, cy);
          first = false;
        } else {
          curveCtx.lineTo(cx, cy);
        }
      }
      curveCtx.stroke();

      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      curveCtx.moveTo(PAD_LEFT + inMax * plotW, PAD_TOP + plotH - outMax * plotH);
      curveCtx.lineTo(PAD_LEFT + plotW, PAD_TOP + plotH - outMax * plotH);
      curveCtx.stroke();

      const nodes = [
        {
          x: PAD_LEFT + params.inputMinimum * plotW,
          y: PAD_TOP + plotH - params.minimum * plotH,
          color: MIN_CONTROL_NODE_COLOR,
          guide: MIN_CONTROL_NODE_GUIDE,
        },
        {
          x: PAD_LEFT + params.inputMaximum * plotW,
          y: PAD_TOP + plotH - params.maximum * plotH,
          color: MAX_CONTROL_NODE_COLOR,
          guide: MAX_CONTROL_NODE_GUIDE,
        },
      ];

      for (const node of nodes) {
        if (!showNodes) continue;

        if (showNodeGuides) {
          curveCtx.strokeStyle = node.guide;
          curveCtx.lineWidth = 1;
          curveCtx.setLineDash([3, 4]);
          curveCtx.beginPath();
          curveCtx.moveTo(node.x, node.y);
          curveCtx.lineTo(node.x, PAD_TOP + plotH);
          curveCtx.moveTo(node.x, node.y);
          curveCtx.lineTo(PAD_LEFT, node.y);
          curveCtx.stroke();
          curveCtx.setLineDash([]);
        }

        curveCtx.fillStyle = node.color;
        curveCtx.beginPath();
        curveCtx.arc(node.x, node.y, 6, 0, Math.PI * 2);
        curveCtx.fill();

        curveCtx.strokeStyle = '#ffffff';
        curveCtx.lineWidth = 1.5;
        curveCtx.stroke();
      }
    }

    drawResponseOverlay(plotW, plotH);

    if (livePressure !== null) {
      const mapped = applyPressureCurve(livePressure, params);
      const dotX = PAD_LEFT + livePressure * plotW;
      const dotY = PAD_TOP + plotH - mapped * plotH;

      curveCtx.strokeStyle = 'rgba(200, 50, 80, 0.2)';
      curveCtx.lineWidth = 1;
      curveCtx.setLineDash([3, 4]);
      curveCtx.beginPath();
      curveCtx.moveTo(dotX, PAD_TOP + plotH);
      curveCtx.lineTo(dotX, dotY);
      curveCtx.moveTo(PAD_LEFT, dotY);
      curveCtx.lineTo(dotX, dotY);
      curveCtx.stroke();
      curveCtx.setLineDash([]);

      curveCtx.fillStyle = '#cc3355';
      curveCtx.beginPath();
      curveCtx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      curveCtx.fill();
    }
  }

  function onCurvePointerDown(event) {
    if (event.button === 2) return;
    customContextMenuOpen = false;

    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    if (customActive) {
      const hitHandle = hitTestCustomHandle(cssX, cssY);
      if (hitHandle) {
        selectedCustomPoint = hitHandle.index;
        selectedCustomHandle = hitHandle.handle;
        draggingNode = { type: 'custom-handle', index: hitHandle.index, handle: hitHandle.handle };
        if (curveCanvasEl?.setPointerCapture) {
          curveCanvasEl.setPointerCapture(event.pointerId);
        }
        return;
      }

      const hitIndex = hitTestCustomPoint(cssX, cssY);
      if (hitIndex === null) {
        selectedCustomPoint = null;
        selectedCustomHandle = null;
        return;
      }
      selectedCustomPoint = hitIndex;
      selectedCustomHandle = null;
      draggingNode = { type: 'custom-anchor', index: hitIndex };
      if (curveCanvasEl?.setPointerCapture) {
        curveCanvasEl.setPointerCapture(event.pointerId);
      }
      return;
    }

    if (!curveActive) return;
    const hit = hitTestCurveNode(cssX, cssY);
    if (!hit) return;

    draggingNode = { type: 'standard', key: hit };
    if (curveCanvasEl?.setPointerCapture) {
      curveCanvasEl.setPointerCapture(event.pointerId);
    }
  }

  function onCurvePointerMove(event) {
    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    if (draggingNode?.type === 'custom-anchor') {
      const pointIndex = draggingNode.index;
      if (pointIndex === null || pointIndex >= customPoints.length) return;

      const next = [...customPoints];
      const point = next[pointIndex];
      const prevX = pointIndex > 0 ? next[pointIndex - 1].x : 0;
      const nextX = pointIndex < next.length - 1 ? next[pointIndex + 1].x : 1;

      let inVal = Math.round(valueFromCurveX(cssX) * 100) / 100;
      const outVal = Math.round(valueFromCurveY(cssY) * 100) / 100;

      if (pointIndex === 0) {
        inVal = 0;
      } else if (pointIndex === next.length - 1) {
        inVal = 1;
      } else {
        inVal = Math.max(prevX + 0.01, Math.min(nextX - 0.01, inVal));
      }

      const dx = inVal - point.x;
      const dy = outVal - point.y;

      next[pointIndex] = {
        ...point,
        x: inVal,
        y: outVal,
        inX: point.inX + dx,
        inY: point.inY + dy,
        outX: point.outX + dx,
        outY: point.outY + dy,
      };

      updateCustomPoints(next);
      drawCurveCanvas();
      return;
    }

    if (draggingNode?.type === 'custom-handle') {
      const pointIndex = draggingNode.index;
      const handle = draggingNode.handle;
      if (pointIndex === null || pointIndex >= customPoints.length) return;

      const next = [...customPoints];
      const point = next[pointIndex];
      const xVal = Math.round(valueFromCurveX(cssX) * 100) / 100;
      const yVal = Math.round(valueFromCurveY(cssY) * 100) / 100;
      const prevX = pointIndex > 0 ? next[pointIndex - 1].x : point.x;
      const nextX = pointIndex < next.length - 1 ? next[pointIndex + 1].x : point.x;

      const clampInX = (value) => Math.max(prevX, Math.min(point.x, value));
      const clampOutX = (value) => Math.max(point.x, Math.min(nextX, value));

      if (handle === 'in') {
        point.inX = clampInX(xVal);
        point.inY = yVal;
        if (point.handleMode === 'mirrored' && pointIndex > 0 && pointIndex < next.length - 1) {
          point.outX = clampOutX(point.x + (point.x - point.inX));
          point.outY = Math.min(1, Math.max(0, point.y + (point.y - point.inY)));
        }
      } else {
        point.outX = clampOutX(xVal);
        point.outY = yVal;
        if (point.handleMode === 'mirrored' && pointIndex > 0 && pointIndex < next.length - 1) {
          point.inX = clampInX(point.x - (point.outX - point.x));
          point.inY = Math.min(1, Math.max(0, point.y - (point.outY - point.y)));
        }
      }

      next[pointIndex] = point;
      updateCustomPoints(next);
      drawCurveCanvas();
      return;
    }

    if (draggingNode?.type === 'standard') {
      let inVal = Math.round(valueFromCurveX(cssX) * 100) / 100;
      let outVal = Math.round(valueFromCurveY(cssY) * 100) / 100;

      if (draggingNode.key === 'a') {
        inVal = Math.min(inVal, params.inputMaximum - 0.01);
        outVal = Math.min(outVal, params.maximum);
        patchParams({
          inputMinimum: inVal,
          minimum: outVal,
        });
      } else {
        inVal = Math.max(inVal, params.inputMinimum + 0.01);
        outVal = Math.max(outVal, params.minimum);
        patchParams({
          inputMaximum: inVal,
          maximum: outVal,
        });
      }

      drawCurveCanvas();
      return;
    }

    if (customActive) {
      if (hitTestCustomHandle(cssX, cssY)) {
        curveCanvasEl.style.cursor = 'crosshair';
      } else if (hitTestCustomPoint(cssX, cssY) !== null) {
        curveCanvasEl.style.cursor = 'move';
      } else {
        curveCanvasEl.style.cursor = 'default';
      }
    } else {
      curveCanvasEl.style.cursor = hitTestCurveNode(cssX, cssY) ? 'move' : 'default';
    }
  }

  function onCurvePointerUp(event) {
    if (!draggingNode) return;
    if (curveCanvasEl?.releasePointerCapture && event?.pointerId !== undefined) {
      try {
        curveCanvasEl.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release errors from already-released pointers.
      }
    }
    draggingNode = null;
    curveCanvasEl.style.cursor = 'default';
  }

  function onCurvePointerLeave(event) {
    if (draggingNode) {
      onCurvePointerUp(event);
      return;
    }

    if (!draggingNode) {
      curveCanvasEl.style.cursor = 'default';
    }
  }

  function toggleCopyMenu(event) {
    event.stopPropagation();
    menuCopyOpen = !menuCopyOpen;
    menuSaveOpen = false;
    customContextMenuOpen = false;
  }

  function toggleSaveMenu(event) {
    event.stopPropagation();
    menuSaveOpen = !menuSaveOpen;
    menuCopyOpen = false;
    customContextMenuOpen = false;
  }

  function closeMenus() {
    menuCopyOpen = false;
    menuSaveOpen = false;
    customContextMenuOpen = false;
    customContextValueX = null;
    customContextValueY = null;
    customContextPointIndex = null;
  }

  function buildChartCanvas(region) {
    if (region === 'full') {
      return curveCanvasEl;
    }

    const plotW = Math.round((curveCanvasEl.width / curveDpr - PAD_LEFT - PAD_RIGHT) * curveDpr);
    const plotH = Math.round((curveCanvasEl.height / curveDpr - PAD_TOP - PAD_BOTTOM) * curveDpr);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = plotW;
    tempCanvas.height = plotH;

    const tempContext = tempCanvas.getContext('2d');
    tempContext.drawImage(
      curveCanvasEl,
      PAD_LEFT * curveDpr,
      PAD_TOP * curveDpr,
      plotW,
      plotH,
      0,
      0,
      plotW,
      plotH,
    );

    return tempCanvas;
  }

  function canvasToJpegCanvas(sourceCanvas) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceCanvas.width;
    tempCanvas.height = sourceCanvas.height;

    const tempContext = tempCanvas.getContext('2d');
    tempContext.fillStyle = '#ffffff';
    tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempContext.drawImage(sourceCanvas, 0, 0);

    return tempCanvas;
  }

  async function copyChart(region) {
    const sourceCanvas = buildChartCanvas(region);

    sourceCanvas.toBlob(async (blob) => {
      if (!blob) return;

      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        const previousLabel = copyButtonLabel;
        copyButtonLabel = 'Copied!';
        setTimeout(() => {
          copyButtonLabel = previousLabel;
        }, 1500);
      } catch (error) {
        console.error('Clipboard write failed:', error);
        copyButtonLabel = 'Failed';
        setTimeout(() => {
          copyButtonLabel = 'Copy ▾';
        }, 1500);
      }
    }, 'image/png');
  }

  function saveChart(region) {
    const sourceCanvas = canvasToJpegCanvas(buildChartCanvas(region));
    const fileName = region === 'full' ? 'pressure-curve-full.jpg' : 'pressure-curve-plot.jpg';

    const link = document.createElement('a');
    link.download = fileName;
    link.href = sourceCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }

  function handleCopyAction(region) {
    closeMenus();
    copyChart(region);
  }

  function handleSaveAction(region) {
    closeMenus();
    saveChart(region);
  }

  onMount(() => {
    curveCtx = curveCanvasEl.getContext('2d');
    resizeCurveCanvas();

    resizeObserver = new ResizeObserver(resizeCurveCanvas);
    resizeObserver.observe(curvePanelEl);

    document.addEventListener('click', closeMenus);
    isReady = true;

    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener('click', closeMenus);
    };
  });
</script>

<div id="curve-panel">
  <div id="panel-left" bind:this={curvePanelEl}>
    <div class="panel-title">Pressure explorer</div>
    <canvas
      id="curve-canvas"
      bind:this={curveCanvasEl}
      on:pointerdown={onCurvePointerDown}
      on:pointermove={onCurvePointerMove}
      on:pointerup={onCurvePointerUp}
      on:pointerleave={onCurvePointerLeave}
      on:contextmenu={openCustomContextMenu}
    ></canvas>

    {#if customContextMenuOpen}
      <div
        class="canvas-context-menu"
        style={`left: ${customContextMenuX}px; top: ${customContextMenuY}px;`}
      >
        {#if isRemovableCustomPoint(customContextPointIndex)}
          <button
            type="button"
            disabled={customPoints[customContextPointIndex].handleMode === 'mirrored'}
            on:click={(event) => setCustomPointHandleModeFromContextMenu('mirrored', event)}
          >
            Handle mode: mirrored
          </button>
          <button
            type="button"
            disabled={customPoints[customContextPointIndex].handleMode === 'broken'}
            on:click={(event) => setCustomPointHandleModeFromContextMenu('broken', event)}
          >
            Handle mode: broken
          </button>
          <button
            type="button"
            on:click={removeCustomPointFromContextMenu}
          >
            Remove point
          </button>
        {/if}
        {#if customContextValueX !== null && customContextValueY !== null}
          <button
            type="button"
            disabled={!canAddCustomPoint}
            on:click={addCustomPointFromContextMenu}
          >
            Add point here
          </button>
        {/if}
      </div>
    {/if}

    <div id="chart-actions">
      <div class="dropdown-wrap">
        <button class="action-btn" on:click={toggleCopyMenu}>{copyButtonLabel}</button>
        <div class="dropdown-menu" class:open={menuCopyOpen}>
          <button on:click={() => handleCopyAction('full')}>Full chart</button>
          <button on:click={() => handleCopyAction('plot')}>Plot area only</button>
        </div>
      </div>

      <div class="dropdown-wrap">
        <button class="action-btn" on:click={toggleSaveMenu}>Save ▾</button>
        <div class="dropdown-menu" class:open={menuSaveOpen}>
          <button on:click={() => handleSaveAction('full')}>Full chart</button>
          <button on:click={() => handleSaveAction('plot')}>Plot area only</button>
        </div>
      </div>
    </div>

    <PressureChartFormat
      bind:showGrid
      bind:showLabels
      bind:showNodes
      bind:showNodeGuides
      {curveActive}
      onToggle={drawCurveCanvas}
    />
  </div>

  <PressureCurveControls
    bind:params
    {defaultParams}
    {curveActive}
    {flatActive}
    {customActive}
    {canAddCustomPoint}
    {canRemoveCustomPoint}
    onAddCustomPoint={addCustomPoint}
    onRemoveCustomPoint={removeCustomPoint}
    {onResponseDataChange}
  />
</div>
