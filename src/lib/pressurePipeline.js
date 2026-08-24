import { applyPressureCurve } from './curveMath';
import { SMOOTHING_ORDER, SMOOTHING_TYPE } from './uiConstants';

export const EMPTY_POINTER_INFO = Object.freeze({
  type: '---',
  pressureRaw: '---',
  pressureCurved: '---',
  pressureSmoothed: '---',
  pressureOutput: '---',
  smoothingOrder: SMOOTHING_ORDER.SMOOTH_THEN_CURVE,
  tiltX: '---',
  tiltY: '---',
  azimuth: '---',
  altitude: '---',
});

// Holds the EMA state for one input surface. Each view that accepts pen input
// makes its own, so switching views starts from a clean smoothing state
// instead of carrying a stale value across.
export function createPressureProcessor() {
  let smoothedPressure = null;

  function smooth(rawPressure, params) {
    const type = params.smoothingType ?? SMOOTHING_TYPE.EMA;
    if (type === SMOOTHING_TYPE.PASSTHROUGH) {
      smoothedPressure = rawPressure;
      return rawPressure;
    }

    const smoothing = Math.min(0.99, Math.max(0, Number(params.emaSmoothing ?? 0)));

    if (smoothing <= 0 || smoothedPressure === null) {
      smoothedPressure = rawPressure;
      return rawPressure;
    }

    const alpha = 1 - smoothing;
    smoothedPressure = smoothedPressure + alpha * (rawPressure - smoothedPressure);
    return smoothedPressure;
  }

  return {
    reset() {
      smoothedPressure = null;
    },

    process(rawPressure, params) {
      const order = params.smoothingOrder ?? SMOOTHING_ORDER.SMOOTH_THEN_CURVE;

      if (order === SMOOTHING_ORDER.CURVE_THEN_SMOOTH) {
        const curved = applyPressureCurve(rawPressure, params);
        const smoothed = smooth(curved, params);
        return {
          order,
          preCurvePressure: rawPressure,
          curvedPressure: curved,
          smoothedPressure: smoothed,
          outputPressure: smoothed,
        };
      }

      const smoothed = smooth(rawPressure, params);
      const curved = applyPressureCurve(smoothed, params);
      return {
        order: SMOOTHING_ORDER.SMOOTH_THEN_CURVE,
        preCurvePressure: smoothed,
        curvedPressure: curved,
        smoothedPressure: smoothed,
        outputPressure: curved,
      };
    },
  };
}

export function buildPointerInfo(pointerEvent, rawPressure, processed) {
  const toDegrees = (radians) => (radians * 180 / Math.PI).toFixed(1);

  return {
    type: pointerEvent.pointerType || '---',
    pressureRaw: rawPressure.toFixed(3),
    pressureCurved: processed.curvedPressure.toFixed(3),
    pressureSmoothed: processed.smoothedPressure.toFixed(3),
    pressureOutput: processed.outputPressure.toFixed(3),
    smoothingOrder: processed.order,
    tiltX: `${Number(pointerEvent.tiltX ?? 0).toFixed(1)}°`,
    tiltY: `${Number(pointerEvent.tiltY ?? 0).toFixed(1)}°`,
    azimuth: `${toDegrees(Number(pointerEvent.azimuthAngle ?? 0))}°`,
    altitude: `${toDegrees(Number(pointerEvent.altitudeAngle ?? 0))}°`,
  };
}
