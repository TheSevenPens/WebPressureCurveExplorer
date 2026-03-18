<script>
  import { onMount } from 'svelte';
  import { applyPressureCurve } from './curveMath';
  import PressureChartFormat from './PressureChartFormat.svelte';
  import PressureCurveControls from './PressureCurveControls.svelte';
  import PressureResponseChart from './PressureResponseChart.svelte';

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
  export let liveRawPressure = null;
  export let defaultParams;

  let pressureResponseData = null;
  let showResponseCurveEffect = true;

  function onResponseDataChange(data) {
    pressureResponseData = data;
  }

  function onResponseShowCurveEffectChange(value) {
    showResponseCurveEffect = value;
  }

  let showGrid = true;
  let showLabels = true;
  let showNodes = true;
  let showNodeGuides = true;
  let showRawIndicator = true;
  let showEffectiveIndicator = true;

  let menuCopyOpen = false;
  let menuSaveOpen = false;
  let bezierContextMenuOpen = false;
  let bezierContextMenuX = 0;
  let bezierContextMenuY = 0;
  let bezierContextValueX = null;
  let bezierContextValueY = null;
  let bezierContextPointIndex = null;
  let copyButtonLabel = 'Copy ▾';

  let curvePanelEl;
  let curveCanvasEl;
  let curveCtx;
  let resizeObserver;
  let curveDpr = 1;
  let lastCurveSize = 0;
  let draggingNode = null;
  let selectedBezierPoint = null;
  let selectedBezierHandle = null;
  let isReady = false;

  $: curveActive = params.curveType === 'basic' || params.curveType === 'sigmoid';
  $: flatActive = params.curveType === 'flat';
  $: bezierActive = params.curveType === 'bezier';
  $: bezierPoints = sanitizeBezierPoints(params.bezierPoints);
  $: canAddBezierPoint = bezierActive && bezierPoints.length < 16;
  $: canRemoveBezierPoint = bezierActive && bezierPoints.length > 2;

  $: if (isReady) {
    params;
    livePressure;
    liveRawPressure;
    showGrid;
    showLabels;
    showNodes;
    showNodeGuides;
    showRawIndicator;
    showEffectiveIndicator;
    drawCurveCanvas();
  }

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }

  function sanitizeBezierPoints(points) {
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

  function isRemovableBezierPoint(index) {
    return index !== null && index > 0 && index < bezierPoints.length - 1;
  }

  function updateBezierPoints(nextPoints) {
    patchParams({ bezierPoints: sanitizeBezierPoints(nextPoints) });
  }

  function bezierPointCenter(index) {
    const { plotW, plotH } = curveLayout();
    const point = bezierPoints[index];
    if (!point) return null;
    return {
      x: PAD_LEFT + point.x * plotW,
      y: PAD_TOP + plotH - point.y * plotH,
    };
  }

  function hitTestBezierPoint(cssX, cssY) {
    for (let i = bezierPoints.length - 1; i >= 0; i -= 1) {
      const center = bezierPointCenter(i);
      if (!center) continue;
      const dx = cssX - center.x;
      const dy = cssY - center.y;
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS) return i;
    }
    return null;
  }

  function bezierHandleCenter(index, handle) {
    const { plotW, plotH } = curveLayout();
    const point = bezierPoints[index];
    if (!point) return null;

    const xValue = handle === 'in' ? point.inX : point.outX;
    const yValue = handle === 'in' ? point.inY : point.outY;
    return {
      x: PAD_LEFT + xValue * plotW,
      y: PAD_TOP + plotH - yValue * plotH,
    };
  }

  function hitTestBezierHandle(cssX, cssY) {
    for (let i = bezierPoints.length - 1; i >= 0; i -= 1) {
      const point = bezierPoints[i];
      const handles = [];
      if (i > 0 && (point.inX !== point.x || point.inY !== point.y)) {
        handles.push('in');
      }
      if (i < bezierPoints.length - 1 && (point.outX !== point.x || point.outY !== point.y)) {
        handles.push('out');
      }

      for (const handle of handles) {
        const center = bezierHandleCenter(i, handle);
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

  function addBezierPoint() {
    if (!canAddBezierPoint) return;

    let targetIndex = 0;
    let maxGap = -1;
    for (let i = 0; i < bezierPoints.length - 1; i += 1) {
      const gap = bezierPoints[i + 1].x - bezierPoints[i].x;
      if (gap > maxGap) {
        maxGap = gap;
        targetIndex = i;
      }
    }

    const left = bezierPoints[targetIndex];
    const right = bezierPoints[targetIndex + 1];
    const newPoint = {
      x: Math.round(((left.x + right.x) / 2) * 100) / 100,
      y: Math.round(((left.y + right.y) / 2) * 100) / 100,
      inX: Math.round(((left.x * 0.66 + right.x * 0.34)) * 100) / 100,
      inY: Math.round(((left.y * 0.66 + right.y * 0.34)) * 100) / 100,
      outX: Math.round(((left.x * 0.34 + right.x * 0.66)) * 100) / 100,
      outY: Math.round(((left.y * 0.34 + right.y * 0.66)) * 100) / 100,
      handleMode: 'broken',
    };

    const next = [...bezierPoints];
    next.splice(targetIndex + 1, 0, newPoint);
    updateBezierPoints(next);
    selectedBezierPoint = targetIndex + 1;
  }

  function removeBezierPoint() {
    if (!canRemoveBezierPoint) return;

    const isRemovableSelection = isRemovableBezierPoint(selectedBezierPoint);
    const removeIndex = isRemovableSelection ? selectedBezierPoint : bezierPoints.length - 2;

    const next = [...bezierPoints];
    next.splice(removeIndex, 1);
    updateBezierPoints(next);
    selectedBezierPoint = null;
    selectedBezierHandle = null;
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

  function insertBezierPointAt(cssX, cssY) {
    if (!canAddBezierPoint || !isInsidePlotArea(cssX, cssY)) return null;

    const rawX = valueFromCurveX(cssX);
    const rawY = valueFromCurveY(cssY);
    let insertIndex = bezierPoints.findIndex((point) => point.x > rawX);

    if (insertIndex <= 0) {
      insertIndex = 1;
    } else if (insertIndex === -1) {
      insertIndex = bezierPoints.length - 1;
    }

    const prevX = bezierPoints[insertIndex - 1].x;
    const nextX = bezierPoints[insertIndex].x;
    const minX = prevX + 0.01;
    const maxX = nextX - 0.01;
    if (minX > maxX) return null;

    let x = Math.min(maxX, Math.max(minX, rawX));
    x = Math.round(x * 100) / 100;
    x = Math.min(maxX, Math.max(minX, x));

    const y = Math.round(rawY * 100) / 100;

    const next = [...bezierPoints];
    next.splice(insertIndex, 0, {
      x,
      y,
      inX: Math.round((prevX + x) * 50) / 100,
      inY: y,
      outX: Math.round((x + nextX) * 50) / 100,
      outY: y,
      handleMode: 'broken',
    });
    updateBezierPoints(next);
    selectedBezierPoint = insertIndex;
    return insertIndex;
  }

  function openBezierContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!bezierActive) {
      closeMenus();
      return;
    }

    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const hitIndex = hitTestBezierPoint(cssX, cssY);
    const insidePlot = isInsidePlotArea(cssX, cssY);
    const canAddAtLocation = canAddBezierPoint && insidePlot;
    const canRemoveAtPoint = isRemovableBezierPoint(hitIndex);

    if (!canAddAtLocation && !canRemoveAtPoint) {
      closeMenus();
      return;
    }

    bezierContextMenuOpen = true;
    bezierContextMenuX = event.clientX;
    bezierContextMenuY = event.clientY;
    bezierContextValueX = canAddAtLocation ? valueFromCurveX(cssX) : null;
    bezierContextValueY = canAddAtLocation ? valueFromCurveY(cssY) : null;
    bezierContextPointIndex = hitIndex;
    if (hitIndex !== null) {
      selectedBezierPoint = hitIndex;
    }
    menuCopyOpen = false;
    menuSaveOpen = false;
  }

  function addBezierPointFromContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (bezierContextValueX === null || bezierContextValueY === null) {
      closeMenus();
      return;
    }

    const { plotW, plotH } = curveLayout();
    const cssX = PAD_LEFT + bezierContextValueX * plotW;
    const cssY = PAD_TOP + plotH - bezierContextValueY * plotH;
    const insertedIndex = insertBezierPointAt(cssX, cssY);
    if (insertedIndex !== null) {
      selectedBezierPoint = insertedIndex;
    }

    closeMenus();
  }

  function removeBezierPointFromContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isRemovableBezierPoint(bezierContextPointIndex)) {
      closeMenus();
      return;
    }

    selectedBezierPoint = bezierContextPointIndex;
    removeBezierPoint();
    closeMenus();
  }

  function setBezierPointHandleModeFromContextMenu(mode, event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isRemovableBezierPoint(bezierContextPointIndex)) {
      closeMenus();
      return;
    }

    const next = [...bezierPoints];
    next[bezierContextPointIndex] = {
      ...next[bezierContextPointIndex],
      handleMode: mode === 'mirrored' ? 'mirrored' : 'broken',
    };

    updateBezierPoints(next);
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
    } else if (bezierActive) {
      curveCtx.strokeStyle = CURVE_COLOR;
      curveCtx.beginPath();
      if (bezierPoints.length > 0) {
        const first = bezierPoints[0];
        curveCtx.moveTo(PAD_LEFT + first.x * plotW, PAD_TOP + plotH - first.y * plotH);

        for (let i = 0; i < bezierPoints.length - 1; i += 1) {
          const a = bezierPoints[i];
          const b = bezierPoints[i + 1];
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
        for (let i = 0; i < bezierPoints.length; i += 1) {
          const point = bezierPoints[i];
          const nodeX = PAD_LEFT + point.x * plotW;
          const nodeY = PAD_TOP + plotH - point.y * plotH;
          const isEndpoint = i === 0 || i === bezierPoints.length - 1;
          const isSelected = i === selectedBezierPoint;

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

              curveCtx.fillStyle = i === selectedBezierPoint && selectedBezierHandle === 'in'
                ? '#111111'
                : '#ffffff';
              curveCtx.strokeStyle = '#2255cc';
              curveCtx.lineWidth = 1.3;
              curveCtx.beginPath();
              curveCtx.arc(inX, inY, HANDLE_RADIUS, 0, Math.PI * 2);
              curveCtx.fill();
              curveCtx.stroke();
            }

            if (i < bezierPoints.length - 1) {
              const outX = PAD_LEFT + point.outX * plotW;
              const outY = PAD_TOP + plotH - point.outY * plotH;
              curveCtx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
              curveCtx.lineWidth = 1;
              curveCtx.setLineDash([]);
              curveCtx.beginPath();
              curveCtx.moveTo(nodeX, nodeY);
              curveCtx.lineTo(outX, outY);
              curveCtx.stroke();

              curveCtx.fillStyle = i === selectedBezierPoint && selectedBezierHandle === 'out'
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

    if (showEffectiveIndicator && livePressure !== null) {
      const mapped = applyPressureCurve(livePressure, params);
      const dotX = PAD_LEFT + livePressure * plotW;
      const dotY = PAD_TOP + plotH - mapped * plotH;

      curveCtx.strokeStyle = 'rgba(20, 160, 80, 0.2)';
      curveCtx.lineWidth = 1;
      curveCtx.setLineDash([3, 4]);
      curveCtx.beginPath();
      curveCtx.moveTo(dotX, PAD_TOP + plotH);
      curveCtx.lineTo(dotX, dotY);
      curveCtx.moveTo(PAD_LEFT, dotY);
      curveCtx.lineTo(dotX, dotY);
      curveCtx.stroke();
      curveCtx.setLineDash([]);

      curveCtx.fillStyle = '#14a050';
      curveCtx.beginPath();
      curveCtx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      curveCtx.fill();
    }

    if (showRawIndicator && liveRawPressure !== null) {
      const mapped = applyPressureCurve(liveRawPressure, params);
      const dotX = PAD_LEFT + liveRawPressure * plotW;
      const dotY = PAD_TOP + plotH - mapped * plotH;

      curveCtx.strokeStyle = 'rgba(130, 60, 200, 0.2)';
      curveCtx.lineWidth = 1;
      curveCtx.setLineDash([3, 4]);
      curveCtx.beginPath();
      curveCtx.moveTo(dotX, PAD_TOP + plotH);
      curveCtx.lineTo(dotX, dotY);
      curveCtx.moveTo(PAD_LEFT, dotY);
      curveCtx.lineTo(dotX, dotY);
      curveCtx.stroke();
      curveCtx.setLineDash([]);

      curveCtx.fillStyle = '#8833cc';
      curveCtx.beginPath();
      curveCtx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      curveCtx.fill();
    }
  }

  function onCurvePointerDown(event) {
    if (event.button === 2) return;
    bezierContextMenuOpen = false;

    const rect = curveCanvasEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    if (bezierActive) {
      const hitHandle = hitTestBezierHandle(cssX, cssY);
      if (hitHandle) {
        selectedBezierPoint = hitHandle.index;
        selectedBezierHandle = hitHandle.handle;
        draggingNode = { type: 'bezier-handle', index: hitHandle.index, handle: hitHandle.handle };
        if (curveCanvasEl?.setPointerCapture) {
          curveCanvasEl.setPointerCapture(event.pointerId);
        }
        return;
      }

      const hitIndex = hitTestBezierPoint(cssX, cssY);
      if (hitIndex === null) {
        selectedBezierPoint = null;
        selectedBezierHandle = null;
        return;
      }
      selectedBezierPoint = hitIndex;
      selectedBezierHandle = null;
      draggingNode = { type: 'bezier-anchor', index: hitIndex };
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

    if (draggingNode?.type === 'bezier-anchor') {
      const pointIndex = draggingNode.index;
      if (pointIndex === null || pointIndex >= bezierPoints.length) return;

      const next = [...bezierPoints];
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

      updateBezierPoints(next);
      drawCurveCanvas();
      return;
    }

    if (draggingNode?.type === 'bezier-handle') {
      const pointIndex = draggingNode.index;
      const handle = draggingNode.handle;
      if (pointIndex === null || pointIndex >= bezierPoints.length) return;

      const next = [...bezierPoints];
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
      updateBezierPoints(next);
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

    if (bezierActive) {
      if (hitTestBezierHandle(cssX, cssY)) {
        curveCanvasEl.style.cursor = 'crosshair';
      } else if (hitTestBezierPoint(cssX, cssY) !== null) {
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
    bezierContextMenuOpen = false;
  }

  function toggleSaveMenu(event) {
    event.stopPropagation();
    menuSaveOpen = !menuSaveOpen;
    menuCopyOpen = false;
    bezierContextMenuOpen = false;
  }

  function closeMenus() {
    menuCopyOpen = false;
    menuSaveOpen = false;
    bezierContextMenuOpen = false;
    bezierContextValueX = null;
    bezierContextValueY = null;
    bezierContextPointIndex = null;
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
      on:contextmenu={openBezierContextMenu}
    ></canvas>

    {#if bezierContextMenuOpen}
      <div
        class="canvas-context-menu"
        style={`left: ${bezierContextMenuX}px; top: ${bezierContextMenuY}px;`}
      >
        {#if isRemovableBezierPoint(bezierContextPointIndex)}
          <button
            type="button"
            disabled={bezierPoints[bezierContextPointIndex].handleMode === 'mirrored'}
            on:click={(event) => setBezierPointHandleModeFromContextMenu('mirrored', event)}
          >
            Handle mode: mirrored
          </button>
          <button
            type="button"
            disabled={bezierPoints[bezierContextPointIndex].handleMode === 'broken'}
            on:click={(event) => setBezierPointHandleModeFromContextMenu('broken', event)}
          >
            Handle mode: broken
          </button>
          <button
            type="button"
            on:click={removeBezierPointFromContextMenu}
          >
            Remove point
          </button>
        {/if}
        {#if bezierContextValueX !== null && bezierContextValueY !== null}
          <button
            type="button"
            disabled={!canAddBezierPoint}
            on:click={addBezierPointFromContextMenu}
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
      bind:showRawIndicator
      bind:showEffectiveIndicator
      {curveActive}
      onToggle={drawCurveCanvas}
    />

    {#if pressureResponseData}
      <PressureResponseChart
        data={pressureResponseData}
        {params}
        showCurveEffect={showResponseCurveEffect}
        {liveRawPressure}
        {livePressure}
        {showRawIndicator}
        {showEffectiveIndicator}
      />
    {/if}
  </div>

  <PressureCurveControls
    bind:params
    {defaultParams}
    {curveActive}
    {flatActive}
    {bezierActive}
    {canAddBezierPoint}
    {canRemoveBezierPoint}
    onAddBezierPoint={addBezierPoint}
    onRemoveBezierPoint={removeBezierPoint}
    {onResponseDataChange}
    {onResponseShowCurveEffectChange}
  />
</div>
