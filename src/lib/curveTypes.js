export const CURVE_TYPE = Object.freeze({
  PASSTHROUGH: 'passthrough',
  FLAT: 'flat',
  BASIC: 'basic',
  EXTENDED: 'extended',
  SIGMOID: 'sigmoid',
  BEZIER: 'bezier',
});

/**
 * A bezier control point. Points are sorted by `x`; the first is pinned to
 * x=0 and the last to x=1. `in`/`out` are the incoming and outgoing handles.
 *
 * @typedef {object} BezierPoint
 * @property {number} x            Anchor position, 0-1
 * @property {number} y            Anchor output, 0-1
 * @property {number} inX          Incoming handle x
 * @property {number} inY          Incoming handle y
 * @property {number} outX         Outgoing handle x
 * @property {number} outY         Outgoing handle y
 * @property {'broken'|'mirrored'} handleMode
 */

/**
 * The single configuration object threaded through the whole app. Owned by
 * App.svelte, read by curveMath and every control.
 *
 * Range fields only apply to `extended` and `sigmoid`; `basic` pins them to
 * 0-1. `flatLevel` only applies to `flat`, `bezierPoints` only to `bezier`.
 *
 * @typedef {object} Params
 * @property {'passthrough'|'flat'|'basic'|'extended'|'sigmoid'|'bezier'} curveType
 * @property {number} softness         Curve shape, -0.9 to 0.9; 0 is linear
 * @property {number} inputMinimum     Start of the input range, 0-1
 * @property {number} inputMaximum     End of the input range, 0-1
 * @property {number} minimum          Start of the output range, 0-1
 * @property {number} maximum          End of the output range, 0-1
 * @property {'clamp'|'cut'} minApproach   Behaviour below inputMinimum
 * @property {number} flatLevel        Constant output for the flat curve, 0-1
 * @property {number} transitionWidth  Hermite smoothing at the range edges, 0-0.5
 * @property {BezierPoint[]} bezierPoints
 * @property {'passthrough'|'ema'} smoothingType
 * @property {number} emaSmoothing     EMA amount, 0-0.99; 0 is no smoothing
 * @property {'smooth-then-curve'|'curve-then-smooth'} smoothingOrder
 */

export {};
