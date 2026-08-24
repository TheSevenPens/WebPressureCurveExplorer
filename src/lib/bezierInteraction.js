import { normalizeBezierPoints } from './curveMath';
import { HANDLE_MODE } from './uiConstants';
import {
  toCanvasX, toCanvasY, valueFromCanvasX, valueFromCanvasY,
  NODE_DRAW_RADIUS, HANDLE_RADIUS,
} from './drawPressureCurve';

/** Generous enough to grab with a pen; larger than the drawn dot on purpose. */
export const NODE_HIT_RADIUS = 8;
const HANDLE_HIT_RADIUS = HANDLE_RADIUS + 1;

/** Points are stored at 2dp, and kept this far apart in x so a segment always
 *  has a usable span. */
const PRECISION = 100;
const MIN_POINT_GAP = 0.01;

const round2 = (value) => Math.round(value * PRECISION) / PRECISION;
const clamp01 = (value) => Math.min(1, Math.max(0, value));

function within(cssX, cssY, center, radius) {
  if (!center) return false;
  const dx = cssX - center.x;
  const dy = cssY - center.y;
  return Math.sqrt(dx * dx + dy * dy) <= radius;
}

export function bezierPointCenter(points, index, { plotW, plotH }) {
  const point = points[index];
  if (!point) return null;
  return { x: toCanvasX(point.x, plotW), y: toCanvasY(point.y, plotH) };
}

export function bezierHandleCenter(points, index, handle, { plotW, plotH }) {
  const point = points[index];
  if (!point) return null;
  const x = handle === 'in' ? point.inX : point.outX;
  const y = handle === 'in' ? point.inY : point.outY;
  return { x: toCanvasX(x, plotW), y: toCanvasY(y, plotH) };
}

/** Topmost anchor under the cursor, or null. Searched last-to-first so the
 *  most recently drawn point wins, matching what the user sees on top. */
export function hitTestBezierPoint(points, cssX, cssY, layout) {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (within(cssX, cssY, bezierPointCenter(points, i, layout), NODE_HIT_RADIUS)) return i;
  }
  return null;
}

export function hitTestBezierHandle(points, cssX, cssY, layout) {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    const handles = [];
    // Endpoints have no outward handle, and a handle sitting exactly on its
    // anchor is not shown, so it should not be grabbable either.
    if (i > 0 && (point.inX !== point.x || point.inY !== point.y)) handles.push('in');
    if (i < points.length - 1 && (point.outX !== point.x || point.outY !== point.y)) handles.push('out');

    for (const handle of handles) {
      if (within(cssX, cssY, bezierHandleCenter(points, i, handle, layout), HANDLE_HIT_RADIUS)) {
        return { index: i, handle };
      }
    }
  }
  return null;
}

export function isRemovableBezierPoint(points, index) {
  return index !== null && index > 0 && index < points.length - 1;
}

/** Split the widest gap, so repeated adds spread out rather than pile up. */
export function addBezierPointInWidestGap(points) {
  let targetIndex = 0;
  let maxGap = -1;
  for (let i = 0; i < points.length - 1; i += 1) {
    const gap = points[i + 1].x - points[i].x;
    if (gap > maxGap) {
      maxGap = gap;
      targetIndex = i;
    }
  }

  const left = points[targetIndex];
  const right = points[targetIndex + 1];
  const next = [...points];
  next.splice(targetIndex + 1, 0, {
    x: round2((left.x + right.x) / 2),
    y: round2((left.y + right.y) / 2),
    inX: round2(left.x * 0.66 + right.x * 0.34),
    inY: round2(left.y * 0.66 + right.y * 0.34),
    outX: round2(left.x * 0.34 + right.x * 0.66),
    outY: round2(left.y * 0.34 + right.y * 0.66),
    handleMode: HANDLE_MODE.BROKEN,
  });

  return { points: normalizeBezierPoints(next), index: targetIndex + 1 };
}

export function removeBezierPointAt(points, index) {
  const next = [...points];
  next.splice(index, 1);
  return normalizeBezierPoints(next);
}

/**
 * Insert at a canvas position. Returns null when the gap is too narrow to
 * take another point without collapsing a segment.
 */
export function insertBezierPointAt(points, cssX, cssY, { plotW, plotH }) {
  const rawX = valueFromCanvasX(cssX, plotW);
  const rawY = valueFromCanvasY(cssY, plotH);

  let insertIndex = points.findIndex((point) => point.x > rawX);
  if (insertIndex <= 0) insertIndex = 1;
  else if (insertIndex === -1) insertIndex = points.length - 1;

  const prevX = points[insertIndex - 1].x;
  const nextX = points[insertIndex].x;
  const minX = prevX + MIN_POINT_GAP;
  const maxX = nextX - MIN_POINT_GAP;
  if (minX > maxX) return null;

  // Clamp, round, then clamp again: rounding can push the value back out.
  let x = Math.min(maxX, Math.max(minX, rawX));
  x = Math.min(maxX, Math.max(minX, round2(x)));
  const y = round2(rawY);

  const next = [...points];
  next.splice(insertIndex, 0, {
    x,
    y,
    inX: round2((prevX + x) / 2),
    inY: y,
    outX: round2((x + nextX) / 2),
    outY: y,
    handleMode: HANDLE_MODE.BROKEN,
  });

  return { points: normalizeBezierPoints(next), index: insertIndex };
}

/**
 * Drag one handle. A mirrored point drags its opposite handle to match,
 * except at the endpoints, which only have one handle to mirror with.
 */
export function moveBezierHandle(points, index, handle, cssX, cssY, { plotW, plotH }) {
  const next = [...points];
  const point = { ...next[index] };
  if (!point) return points;

  const xVal = round2(valueFromCanvasX(cssX, plotW));
  const yVal = round2(valueFromCanvasY(cssY, plotH));

  const prevX = index > 0 ? next[index - 1].x : point.x;
  const nextX = index < next.length - 1 ? next[index + 1].x : point.x;
  const clampInX = (value) => Math.max(prevX, Math.min(point.x, value));
  const clampOutX = (value) => Math.max(point.x, Math.min(nextX, value));

  const mirrored = point.handleMode === HANDLE_MODE.MIRRORED
    && index > 0
    && index < next.length - 1;

  if (handle === 'in') {
    point.inX = clampInX(xVal);
    point.inY = yVal;
    if (mirrored) {
      point.outX = clampOutX(point.x + (point.x - point.inX));
      point.outY = clamp01(point.y + (point.y - point.inY));
    }
  } else {
    point.outX = clampOutX(xVal);
    point.outY = yVal;
    if (mirrored) {
      point.inX = clampInX(point.x - (point.outX - point.x));
      point.inY = clamp01(point.y - (point.outY - point.y));
    }
  }

  next[index] = point;
  return normalizeBezierPoints(next);
}

export function setBezierHandleMode(points, index, mode) {
  const next = [...points];
  next[index] = {
    ...next[index],
    handleMode: mode === HANDLE_MODE.MIRRORED ? HANDLE_MODE.MIRRORED : HANDLE_MODE.BROKEN,
  };
  return normalizeBezierPoints(next);
}

export { NODE_DRAW_RADIUS };
