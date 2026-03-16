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

export function applyPressureCurve(x, params) {
  const {
    inputMinimum,
    inputMaximum,
    minimum,
    maximum,
    curveType,
    transitionWidth,
    flatLevel,
  } = params;

  if (curveType === 'null') return x;
  if (curveType === 'flat') return flatLevel;

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
