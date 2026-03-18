export function cubicHermite(t, y0, m0, y1, m1) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0
    + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
}

export function rawCurveOutput(xNorm, params) {
  const { softness, minimum, maximum, curveType } = params;
  let curved;

  if (curveType === 'sigmoid') {
    const k = softness * 14;
    if (Math.abs(k) < 0.01) {
      curved = xNorm;
    } else {
      const sig = (t) => 1 / (1 + Math.exp(-k * (t - 0.5)));
      const s0 = sig(0);
      const s1 = sig(1);
      const range = s1 - s0;
      curved = Math.abs(range) < 1e-10 ? xNorm : (sig(xNorm) - s0) / range;
    }
  } else {
    const exponent = softness >= 0 ? 1 - softness : 1 / (1 + softness);
    curved = Math.pow(Math.max(0, xNorm), exponent);
  }

  return minimum + curved * (maximum - minimum);
}

export function rawCurveSlope(xNorm, params) {
  const epsilon = 0.0005;
  const x1 = Math.min(1, xNorm + epsilon);
  const x0 = Math.max(0, xNorm - epsilon);
  return (rawCurveOutput(x1, params) - rawCurveOutput(x0, params)) / (x1 - x0);
}

function normalizeCustomPoints(points) {
  const source = Array.isArray(points) && points.length > 0
    ? points
    : [{ x: 0, y: 0 }, { x: 1, y: 1 }];

  const base = source
    .map((point) => ({
      x: Number(point?.x ?? 0),
      y: Number(point?.y ?? 0),
      inX: Number(point?.inX ?? point?.x ?? 0),
      inY: Number(point?.inY ?? point?.y ?? 0),
      outX: Number(point?.outX ?? point?.x ?? 0),
      outY: Number(point?.outY ?? point?.y ?? 0),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      x: Math.min(1, Math.max(0, point.x)),
      y: Math.min(1, Math.max(0, point.y)),
      inX: Number.isFinite(point.inX) ? Math.min(1, Math.max(0, point.inX)) : Math.min(1, Math.max(0, point.x)),
      inY: Number.isFinite(point.inY) ? Math.min(1, Math.max(0, point.inY)) : Math.min(1, Math.max(0, point.y)),
      outX: Number.isFinite(point.outX) ? Math.min(1, Math.max(0, point.outX)) : Math.min(1, Math.max(0, point.x)),
      outY: Number.isFinite(point.outY) ? Math.min(1, Math.max(0, point.outY)) : Math.min(1, Math.max(0, point.y)),
    }))
    .sort((a, b) => a.x - b.x);

  const normalized = base;

  if (normalized.length === 0) {
    return [
      { x: 0, y: 0, inX: 0, inY: 0, outX: 0.33, outY: 0 },
      { x: 1, y: 1, inX: 0.67, inY: 1, outX: 1, outY: 1 },
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
    });
  } else {
    normalized[0] = { ...normalized[0], x: 0 };
  }

  const lastIndex = normalized.length - 1;
  if (normalized[lastIndex].x < 1) {
    normalized.push({
      x: 1,
      y: normalized[lastIndex].y,
      inX: Math.max(0, (1 + normalized[lastIndex].x) / 2),
      inY: normalized[lastIndex].y,
      outX: 1,
      outY: normalized[lastIndex].y,
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
  }

  normalized[0].inX = normalized[0].x;
  normalized[0].inY = normalized[0].y;
  normalized[normalized.length - 1].outX = normalized[normalized.length - 1].x;
  normalized[normalized.length - 1].outY = normalized[normalized.length - 1].y;

  return normalized;
}

function buildCustomSegments(points) {
  const normalized = normalizeCustomPoints(points);
  const segments = [];
  for (let i = 0; i < normalized.length - 1; i += 1) {
    segments.push({
      p0: normalized[i],
      c0: { x: normalized[i].outX, y: normalized[i].outY },
      c1: { x: normalized[i + 1].inX, y: normalized[i + 1].inY },
      p1: normalized[i + 1],
    });
  }

  return segments;
}

function cubicAt(t, p0, c0, c1, p1) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const w0 = mt2 * mt;
  const w1 = 3 * mt2 * t;
  const w2 = 3 * mt * t2;
  const w3 = t2 * t;
  return {
    x: w0 * p0.x + w1 * c0.x + w2 * c1.x + w3 * p1.x,
    y: w0 * p0.y + w1 * c0.y + w2 * c1.y + w3 * p1.y,
  };
}

function solveBezierTForX(x, segment) {
  let lo = 0;
  let hi = 1;

  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    const xm = cubicAt(mid, segment.p0, segment.c0, segment.c1, segment.p1).x;
    if (xm < x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

function evaluateCustomCurve(x, points) {
  const segments = buildCustomSegments(points);

  if (segments.length === 0) return x;

  const first = segments[0].p0;
  if (x <= first.x) return first.y;

  const lastSegment = segments[segments.length - 1];
  const lastPoint = lastSegment.p1;
  if (x >= lastPoint.x) return lastPoint.y;

  for (const segment of segments) {
    const x0 = segment.p0.x;
    const x1 = segment.p1.x;
    if (x < x0 || x > x1) continue;

    const span = x1 - x0;
    if (span <= 1e-6) return segment.p1.y;
    const t = solveBezierTForX(x, segment);
    return cubicAt(t, segment.p0, segment.c0, segment.c1, segment.p1).y;
  }

  return lastPoint.y;
}

export function applyPressureCurve(x, params) {
  const {
    inputMinimum,
    inputMaximum,
    minimum,
    maximum,
    curveType,
    transitionWidth,
    flatLevel,
    bezierPoints,
  } = params;

  if (curveType === 'null-effect') return x;
  if (curveType === 'flat') return flatLevel;
  if (curveType === 'bezier') {
    const clampedX = Math.min(1, Math.max(0, x));
    return evaluateCustomCurve(clampedX, bezierPoints);
  }

  const inputRange = inputMaximum - inputMinimum;
  const xNorm = inputRange > 0 ? Math.min(1, Math.max(0, (x - inputMinimum) / inputRange)) : 0;
  const baseOutput = rawCurveOutput(xNorm, params);

  if (transitionWidth > 0) {
    const tw = transitionWidth;

    if (xNorm < tw) {
      const t = xNorm / tw;
      const y1 = rawCurveOutput(tw, params);
      const m1 = rawCurveSlope(tw, params) * tw;
      return cubicHermite(t, minimum, 0, y1, m1);
    }

    if (xNorm > 1 - tw) {
      const s = (xNorm - (1 - tw)) / tw;
      const y0 = rawCurveOutput(1 - tw, params);
      const m0 = rawCurveSlope(1 - tw, params) * tw;
      return cubicHermite(s, y0, m0, maximum, 0);
    }
  }

  return baseOutput;
}
