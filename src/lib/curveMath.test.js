import { describe, it, expect } from 'vitest';
import {
  applyPressureCurve,
  isIdentityCurve,
  invertPressureCurve,
  normalizeBezierPoints,
  cubicHermite,
  rawCurveOutput,
} from './curveMath';
import { CURVE_TYPE } from './curveTypes';
import { MIN_APPROACH, HANDLE_MODE } from './uiConstants';

/** Full-range, no-op defaults; each test overrides only what it exercises. */
function params(overrides = {}) {
  return {
    curveType: CURVE_TYPE.BASIC,
    softness: 0,
    inputMinimum: 0,
    inputMaximum: 1,
    minimum: 0,
    maximum: 1,
    minApproach: MIN_APPROACH.CLAMP,
    transitionWidth: 0,
    flatLevel: 0.5,
    bezierPoints: [
      { x: 0, y: 0, inX: 0, inY: 0, outX: 0.33, outY: 0, handleMode: HANDLE_MODE.BROKEN },
      { x: 1, y: 1, inX: 0.67, inY: 1, outX: 1, outY: 1, handleMode: HANDLE_MODE.BROKEN },
    ],
    ...overrides,
  };
}

const SAMPLES = [0, 0.001, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999, 1];

describe('applyPressureCurve', () => {
  it('passes input through unchanged for passthrough', () => {
    const p = params({ curveType: CURVE_TYPE.PASSTHROUGH });
    for (const x of SAMPLES) expect(applyPressureCurve(x, p)).toBe(x);
  });

  it('returns the constant for flat, ignoring input', () => {
    const p = params({ curveType: CURVE_TYPE.FLAT, flatLevel: 0.37 });
    for (const x of SAMPLES) expect(applyPressureCurve(x, p)).toBe(0.37);
  });

  it('is the identity for a neutral basic curve', () => {
    const p = params();
    for (const x of SAMPLES) expect(applyPressureCurve(x, p)).toBeCloseTo(x, 12);
  });

  it('holds the endpoints for every curve type', () => {
    for (const curveType of [
      CURVE_TYPE.PASSTHROUGH, CURVE_TYPE.BASIC, CURVE_TYPE.EXTENDED, CURVE_TYPE.SIGMOID,
    ]) {
      const p = params({ curveType, softness: 0.5 });
      expect(applyPressureCurve(0, p)).toBeCloseTo(0, 10);
      expect(applyPressureCurve(1, p)).toBeCloseTo(1, 10);
    }
  });

  it('bows above the diagonal for positive softness and below for negative', () => {
    expect(applyPressureCurve(0.5, params({ softness: 0.6 }))).toBeGreaterThan(0.5);
    expect(applyPressureCurve(0.5, params({ softness: -0.6 }))).toBeLessThan(0.5);
  });

  it('stays monotonic across the range', () => {
    for (const softness of [-0.9, -0.4, 0, 0.4, 0.9]) {
      for (const curveType of [CURVE_TYPE.BASIC, CURVE_TYPE.SIGMOID]) {
        const p = params({ curveType, softness });
        let previous = -Infinity;
        for (let i = 0; i <= 50; i++) {
          const y = applyPressureCurve(i / 50, p);
          expect(y).toBeGreaterThanOrEqual(previous - 1e-12);
          previous = y;
        }
      }
    }
  });

  it('scales into the output range', () => {
    const p = params({ curveType: CURVE_TYPE.EXTENDED, minimum: 0.2, maximum: 0.8 });
    expect(applyPressureCurve(0, p)).toBeCloseTo(0.2, 10);
    expect(applyPressureCurve(1, p)).toBeCloseTo(0.8, 10);
    expect(applyPressureCurve(0.5, p)).toBeCloseTo(0.5, 10);
  });

  describe('input range', () => {
    it('clamps to the output minimum below the input minimum', () => {
      const p = params({ curveType: CURVE_TYPE.EXTENDED, inputMinimum: 0.3, minimum: 0.1 });
      expect(applyPressureCurve(0, p)).toBeCloseTo(0.1, 10);
      expect(applyPressureCurve(0.2, p)).toBeCloseTo(0.1, 10);
      expect(applyPressureCurve(0.3, p)).toBeCloseTo(0.1, 10);
    });

    it('cuts to zero below the input minimum when minApproach is cut', () => {
      const p = params({
        curveType: CURVE_TYPE.EXTENDED,
        inputMinimum: 0.3,
        minimum: 0.1,
        minApproach: MIN_APPROACH.CUT,
      });
      expect(applyPressureCurve(0, p)).toBe(0);
      expect(applyPressureCurve(0.29, p)).toBe(0);
      expect(applyPressureCurve(0.3, p)).toBeCloseTo(0.1, 10);
    });

    it('clamps above the input maximum', () => {
      const p = params({ curveType: CURVE_TYPE.EXTENDED, inputMaximum: 0.7, maximum: 0.9 });
      expect(applyPressureCurve(0.7, p)).toBeCloseTo(0.9, 10);
      expect(applyPressureCurve(1, p)).toBeCloseTo(0.9, 10);
    });

    it('does not produce NaN when the input range is degenerate', () => {
      const p = params({ curveType: CURVE_TYPE.EXTENDED, inputMinimum: 0.5, inputMaximum: 0.5 });
      for (const x of SAMPLES) {
        const y = applyPressureCurve(x, p);
        expect(Number.isFinite(y)).toBe(true);
      }
    });

    it('does not produce NaN when the output range is degenerate', () => {
      const p = params({ curveType: CURVE_TYPE.EXTENDED, minimum: 0.4, maximum: 0.4 });
      for (const x of SAMPLES) expect(applyPressureCurve(x, p)).toBeCloseTo(0.4, 10);
    });
  });

  describe('sigmoid', () => {
    it('falls back to linear at negligible steepness', () => {
      const p = params({ curveType: CURVE_TYPE.SIGMOID, softness: 0 });
      for (const x of SAMPLES) expect(applyPressureCurve(x, p)).toBeCloseTo(x, 10);
    });

    it('is symmetric about the midpoint', () => {
      const p = params({ curveType: CURVE_TYPE.SIGMOID, softness: 0.5 });
      expect(applyPressureCurve(0.5, p)).toBeCloseTo(0.5, 6);
      const low = applyPressureCurve(0.25, p);
      const high = applyPressureCurve(0.75, p);
      expect(low + high).toBeCloseTo(1, 6);
    });
  });

  describe('bezier', () => {
    it('holds the pinned endpoints', () => {
      const p = params({ curveType: CURVE_TYPE.BEZIER });
      expect(applyPressureCurve(0, p)).toBeCloseTo(0, 6);
      expect(applyPressureCurve(1, p)).toBeCloseTo(1, 6);
    });

    it('clamps inputs outside the unit range', () => {
      const p = params({ curveType: CURVE_TYPE.BEZIER });
      expect(applyPressureCurve(-0.5, p)).toBeCloseTo(applyPressureCurve(0, p), 10);
      expect(applyPressureCurve(1.5, p)).toBeCloseTo(applyPressureCurve(1, p), 10);
    });

    it('reproduces a straight diagonal when the handles lie on it', () => {
      const p = params({
        curveType: CURVE_TYPE.BEZIER,
        bezierPoints: [
          { x: 0, y: 0, inX: 0, inY: 0, outX: 1 / 3, outY: 1 / 3, handleMode: HANDLE_MODE.BROKEN },
          { x: 1, y: 1, inX: 2 / 3, inY: 2 / 3, outX: 1, outY: 1, handleMode: HANDLE_MODE.BROKEN },
        ],
      });
      for (const x of SAMPLES) expect(applyPressureCurve(x, p)).toBeCloseTo(x, 5);
    });

    it('survives a segment with a near-zero x span', () => {
      const p = params({
        curveType: CURVE_TYPE.BEZIER,
        bezierPoints: [
          { x: 0, y: 0, inX: 0, inY: 0, outX: 0, outY: 0, handleMode: HANDLE_MODE.BROKEN },
          { x: 0.5, y: 0.4, inX: 0.5, inY: 0.4, outX: 0.5, outY: 0.4, handleMode: HANDLE_MODE.BROKEN },
          { x: 0.5000001, y: 0.6, inX: 0.5000001, inY: 0.6, outX: 0.5000001, outY: 0.6, handleMode: HANDLE_MODE.BROKEN },
          { x: 1, y: 1, inX: 1, inY: 1, outX: 1, outY: 1, handleMode: HANDLE_MODE.BROKEN },
        ],
      });
      for (const x of SAMPLES) expect(Number.isFinite(applyPressureCurve(x, p))).toBe(true);
    });
  });

  it('stays finite with boundary transition smoothing enabled', () => {
    const p = params({ curveType: CURVE_TYPE.EXTENDED, softness: 0.5, transitionWidth: 0.3 });
    for (let i = 0; i <= 50; i++) {
      expect(Number.isFinite(applyPressureCurve(i / 50, p))).toBe(true);
    }
  });
});

describe('isIdentityCurve', () => {
  it('is true for passthrough', () => {
    expect(isIdentityCurve(params({ curveType: CURVE_TYPE.PASSTHROUGH }))).toBe(true);
  });

  it('is true for a neutral basic, extended or sigmoid curve', () => {
    for (const curveType of [CURVE_TYPE.BASIC, CURVE_TYPE.EXTENDED, CURVE_TYPE.SIGMOID]) {
      expect(isIdentityCurve(params({ curveType }))).toBe(true);
    }
  });

  it('is false once the curve bends', () => {
    expect(isIdentityCurve(params({ softness: 0.05 }))).toBe(false);
    expect(isIdentityCurve(params({ softness: -0.05 }))).toBe(false);
  });

  it('is false for a narrowed range', () => {
    expect(isIdentityCurve(params({ curveType: CURVE_TYPE.EXTENDED, maximum: 0.9 }))).toBe(false);
    expect(isIdentityCurve(params({ curveType: CURVE_TYPE.EXTENDED, inputMinimum: 0.1 }))).toBe(false);
  });

  it('is false for a flat curve, including one at the midpoint', () => {
    expect(isIdentityCurve(params({ curveType: CURVE_TYPE.FLAT, flatLevel: 0.5 }))).toBe(false);
  });
});

describe('invertPressureCurve', () => {
  it('round-trips every monotonic curve type', () => {
    const cases = [
      params(),
      params({ softness: 0.6 }),
      params({ softness: -0.6 }),
      params({ curveType: CURVE_TYPE.SIGMOID, softness: 0.5 }),
      params({ curveType: CURVE_TYPE.BEZIER }),
    ];
    for (const p of cases) {
      for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const y = applyPressureCurve(x, p);
        expect(invertPressureCurve(y, p, -1)).toBeCloseTo(x, 5);
      }
    }
  });

  it('clamps to the ends outside the output range', () => {
    const p = params({ curveType: CURVE_TYPE.EXTENDED, minimum: 0.2, maximum: 0.8 });
    expect(invertPressureCurve(0.1, p, -1)).toBe(0);
    expect(invertPressureCurve(0.9, p, -1)).toBe(1);
  });

  it('falls back when the curve is not invertible', () => {
    const flat = params({ curveType: CURVE_TYPE.FLAT, flatLevel: 0.5 });
    expect(invertPressureCurve(0.5, flat, 0.42)).toBe(0.42);

    const degenerate = params({ curveType: CURVE_TYPE.EXTENDED, minimum: 0.4, maximum: 0.4 });
    expect(invertPressureCurve(0.4, degenerate, 0.42)).toBe(0.42);
  });

  it('defaults the fallback to 0', () => {
    expect(invertPressureCurve(0.5, params({ curveType: CURVE_TYPE.FLAT }))).toBe(0);
  });
});

describe('normalizeBezierPoints', () => {
  it('pins the first point to x=0 and the last to x=1', () => {
    const points = normalizeBezierPoints([
      { x: 0.2, y: 0.1 },
      { x: 0.8, y: 0.9 },
    ]);
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBe(1);
  });

  it('sorts by x', () => {
    const points = normalizeBezierPoints([
      { x: 0, y: 0 },
      { x: 0.7, y: 0.7 },
      { x: 0.3, y: 0.3 },
      { x: 1, y: 1 },
    ]);
    const xs = points.map((p) => p.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('clamps values into the unit square', () => {
    const points = normalizeBezierPoints([
      { x: -1, y: -1 },
      { x: 2, y: 2 },
    ]);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it('produces a usable pair from empty or missing input', () => {
    for (const input of [[], null, undefined]) {
      const points = normalizeBezierPoints(input);
      expect(points.length).toBeGreaterThanOrEqual(2);
      expect(points[0].x).toBe(0);
      expect(points[points.length - 1].x).toBe(1);
    }
  });

  it('gives every point a full set of handles', () => {
    const points = normalizeBezierPoints([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]);
    for (const p of points) {
      for (const key of ['x', 'y', 'inX', 'inY', 'outX', 'outY']) {
        expect(Number.isFinite(p[key])).toBe(true);
      }
    }
  });
});

describe('cubicHermite', () => {
  it('interpolates between the endpoints', () => {
    expect(cubicHermite(0, 0.2, 0, 0.8, 0)).toBeCloseTo(0.2, 12);
    expect(cubicHermite(1, 0.2, 0, 0.8, 0)).toBeCloseTo(0.8, 12);
  });

  it('reproduces a straight line when the slopes match it', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(cubicHermite(t, 0, 1, 1, 1)).toBeCloseTo(t, 12);
    }
  });
});

describe('rawCurveOutput', () => {
  it('spans the output range', () => {
    const p = params({ minimum: 0.1, maximum: 0.9 });
    expect(rawCurveOutput(0, p)).toBeCloseTo(0.1, 10);
    expect(rawCurveOutput(1, p)).toBeCloseTo(0.9, 10);
  });

  it('is finite at the extremes of softness', () => {
    for (const softness of [-0.9, 0.9]) {
      for (const curveType of [CURVE_TYPE.BASIC, CURVE_TYPE.SIGMOID]) {
        const p = params({ curveType, softness });
        expect(Number.isFinite(rawCurveOutput(0, p))).toBe(true);
        expect(Number.isFinite(rawCurveOutput(1, p))).toBe(true);
      }
    }
  });
});
