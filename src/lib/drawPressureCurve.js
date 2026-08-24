import { applyPressureCurve, invertPressureCurve } from './curveMath';
import { CURVE_TYPE } from './curveTypes';
import { MIN_APPROACH, SMOOTHING_ORDER } from './uiConstants';
import { PAD_LEFT, PAD_TOP, PAD_RIGHT, PAD_BOTTOM } from './canvasConstants';
import { drawBackground, drawGrid, drawLabels, drawIndicator } from './canvasUtils';
import { RAW_INDICATOR, EFFECTIVE_INDICATOR } from './indicatorStyles';

export const CURVE_COLOR = '#000000';
export const MIN_CONTROL_NODE_COLOR = 'rgb(255, 0, 136)';
export const MAX_CONTROL_NODE_COLOR = '#00d0ff';
export const CONTROL_NODE_GUIDE = 'rgba(0, 0, 0, 0.25)';

export const NODE_DRAW_RADIUS = 6;
export const HANDLE_RADIUS = 5;

const BEZIER_ANCHOR_COLOR = '#2255cc';
const BEZIER_ENDPOINT_COLOR = '#7a7a8b';
const BEZIER_GUIDE_COLOR = 'rgba(0, 0, 0, 0.22)';
const SELECTED_OUTLINE = '#111111';

/** Plot geometry for a canvas of this CSS size. Shared with hit testing. */
export function curveLayout(width, height) {
  return {
    width,
    height,
    plotW: width - PAD_LEFT - PAD_RIGHT,
    plotH: height - PAD_TOP - PAD_BOTTOM,
  };
}

/** Data space (0-1, y up) to canvas space (pixels, y down). */
export function toCanvasX(x, plotW) {
  return PAD_LEFT + x * plotW;
}

export function toCanvasY(y, plotH) {
  return PAD_TOP + plotH - y * plotH;
}

function strokeSegment(ctx, points) {
  ctx.strokeStyle = CURVE_COLOR;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}

/** The curve itself, for whichever type is active. */
export function drawCurvePath(ctx, { params, bezierPoints, plotW, plotH }) {
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  if (params.curveType === CURVE_TYPE.PASSTHROUGH) {
    strokeSegment(ctx, [
      [PAD_LEFT, toCanvasY(0, plotH)],
      [PAD_LEFT + plotW, toCanvasY(1, plotH)],
    ]);
    return;
  }

  if (params.curveType === CURVE_TYPE.FLAT) {
    const fy = toCanvasY(params.flatLevel, plotH);
    strokeSegment(ctx, [[PAD_LEFT, fy], [PAD_LEFT + plotW, fy]]);
    return;
  }

  if (params.curveType === CURVE_TYPE.BEZIER) {
    ctx.strokeStyle = CURVE_COLOR;
    ctx.beginPath();
    if (bezierPoints.length > 0) {
      const first = bezierPoints[0];
      ctx.moveTo(toCanvasX(first.x, plotW), toCanvasY(first.y, plotH));

      for (let i = 0; i < bezierPoints.length - 1; i += 1) {
        const a = bezierPoints[i];
        const b = bezierPoints[i + 1];
        ctx.bezierCurveTo(
          toCanvasX(a.outX, plotW), toCanvasY(a.outY, plotH),
          toCanvasX(b.inX, plotW), toCanvasY(b.inY, plotH),
          toCanvasX(b.x, plotW), toCanvasY(b.y, plotH),
        );
      }
    }
    ctx.stroke();
    return;
  }

  const { inputMinimum: inMin, inputMaximum: inMax, minimum: outMin, maximum: outMax } = params;

  // Below the input minimum: hold at the output minimum, or cut to zero.
  strokeSegment(ctx, params.minApproach === MIN_APPROACH.CUT
    ? [
      [PAD_LEFT, toCanvasY(0, plotH)],
      [toCanvasX(inMin, plotW), toCanvasY(0, plotH)],
      [toCanvasX(inMin, plotW), toCanvasY(outMin, plotH)],
    ]
    : [
      [PAD_LEFT, toCanvasY(outMin, plotH)],
      [toCanvasX(inMin, plotW), toCanvasY(outMin, plotH)],
    ]);

  // The curve body, sampled one canvas pixel at a time.
  ctx.strokeStyle = CURVE_COLOR;
  ctx.beginPath();
  const pxStart = Math.round(inMin * plotW);
  const pxEnd = Math.round(inMax * plotW);
  for (let px = pxStart; px <= pxEnd; px += 1) {
    const y = applyPressureCurve(px / plotW, params);
    const cx = PAD_LEFT + px;
    const cy = toCanvasY(y, plotH);
    if (px === pxStart) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Above the input maximum: hold at the output maximum.
  strokeSegment(ctx, [
    [toCanvasX(inMax, plotW), toCanvasY(outMax, plotH)],
    [PAD_LEFT + plotW, toCanvasY(outMax, plotH)],
  ]);
}

/** The draggable min/max range nodes, for extended and sigmoid. */
export function drawControlNodes(ctx, { params, plotW, plotH, showNodeGuides }) {
  // basic pins its ranges, so it exposes nothing to drag.
  if (params.curveType === CURVE_TYPE.BASIC) return;

  const nodes = [
    { x: params.inputMinimum, y: params.minimum, color: MIN_CONTROL_NODE_COLOR },
    { x: params.inputMaximum, y: params.maximum, color: MAX_CONTROL_NODE_COLOR },
  ];

  for (const node of nodes) {
    const cx = toCanvasX(node.x, plotW);
    const cy = toCanvasY(node.y, plotH);

    if (showNodeGuides) {
      ctx.strokeStyle = CONTROL_NODE_GUIDE;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, PAD_TOP + plotH);
      ctx.moveTo(cx, cy);
      ctx.lineTo(PAD_LEFT, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(cx, cy, NODE_DRAW_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawBezierHandle(ctx, { anchorX, anchorY, handleX, handleY, selected }) {
  ctx.strokeStyle = BEZIER_GUIDE_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY);
  ctx.lineTo(handleX, handleY);
  ctx.stroke();

  ctx.fillStyle = selected ? SELECTED_OUTLINE : '#ffffff';
  ctx.strokeStyle = BEZIER_ANCHOR_COLOR;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(handleX, handleY, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Bezier anchors and, when guides are on, their handles. */
export function drawBezierEditor(ctx, {
  bezierPoints, plotW, plotH, showNodeGuides, selectedBezierPoint, selectedBezierHandle,
}) {
  for (let i = 0; i < bezierPoints.length; i += 1) {
    const point = bezierPoints[i];
    const anchorX = toCanvasX(point.x, plotW);
    const anchorY = toCanvasY(point.y, plotH);
    const isEndpoint = i === 0 || i === bezierPoints.length - 1;
    const isSelected = i === selectedBezierPoint;

    if (showNodeGuides) {
      // The first point has no incoming handle and the last none outgoing.
      if (i > 0) {
        drawBezierHandle(ctx, {
          anchorX,
          anchorY,
          handleX: toCanvasX(point.inX, plotW),
          handleY: toCanvasY(point.inY, plotH),
          selected: isSelected && selectedBezierHandle === 'in',
        });
      }
      if (i < bezierPoints.length - 1) {
        drawBezierHandle(ctx, {
          anchorX,
          anchorY,
          handleX: toCanvasX(point.outX, plotW),
          handleY: toCanvasY(point.outY, plotH),
          selected: isSelected && selectedBezierHandle === 'out',
        });
      }
    }

    ctx.fillStyle = isEndpoint ? BEZIER_ENDPOINT_COLOR : BEZIER_ANCHOR_COLOR;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, NODE_DRAW_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isSelected ? SELECTED_OUTLINE : '#ffffff';
    ctx.lineWidth = isSelected ? 2.2 : 1.5;
    ctx.stroke();
  }
}

/**
 * X for the effective indicator. Under smooth-then-curve `livePressure` is the
 * smoothed input the pipeline really fed to the curve, so the point is on the
 * curve by construction. Under curve-then-smooth the smoothing runs after the
 * curve and the output corresponds to no input the pipeline evaluated, so show
 * the input that would produce it.
 */
export function effectiveIndicatorX(livePressure, output, params) {
  const order = params.smoothingOrder ?? SMOOTHING_ORDER.SMOOTH_THEN_CURVE;
  return order === SMOOTHING_ORDER.CURVE_THEN_SMOOTH
    ? invertPressureCurve(output, params, livePressure)
    : livePressure;
}

export function drawLiveIndicators(ctx, {
  params, plotW, plotH,
  livePressure, liveRawPressure, liveOutputPressure,
  showRawIndicator, showEffectiveIndicator,
}) {
  if (showEffectiveIndicator && livePressure !== null) {
    const output = liveOutputPressure ?? applyPressureCurve(livePressure, params);
    const x = effectiveIndicatorX(livePressure, output, params);
    drawIndicator(ctx, plotW, plotH, x, output, EFFECTIVE_INDICATOR.solid, EFFECTIVE_INDICATOR.guide);
  }

  if (showRawIndicator && liveRawPressure !== null) {
    const output = applyPressureCurve(liveRawPressure, params);
    drawIndicator(ctx, plotW, plotH, liveRawPressure, output, RAW_INDICATOR.solid, RAW_INDICATOR.guide);
  }
}

/** The whole chart. The component keeps sizing and pointer handling. */
export function drawCurveChart(ctx, options) {
  const {
    width, height, plotW, plotH,
    params, bezierPoints,
    showGrid, showLabels, showNodes,
  } = options;

  drawBackground(ctx, width, height, plotW, plotH);
  if (showGrid) drawGrid(ctx, plotW, plotH);
  if (showLabels) drawLabels(ctx, width, height, plotW, plotH);

  drawCurvePath(ctx, options);

  if (showNodes) {
    if (params.curveType === CURVE_TYPE.BEZIER) {
      drawBezierEditor(ctx, options);
    } else if (params.curveType !== CURVE_TYPE.PASSTHROUGH && params.curveType !== CURVE_TYPE.FLAT) {
      drawControlNodes(ctx, options);
    }
  }

  drawLiveIndicators(ctx, options);
}
