export const SMOOTHING_ORDER = Object.freeze({
  SMOOTH_THEN_CURVE: 'smooth-then-curve',
  CURVE_THEN_SMOOTH: 'curve-then-smooth',
});

export const SMOOTHING_TYPE = Object.freeze({
  PASSTHROUGH: 'passthrough',
  EMA: 'ema',
});

export const MIN_APPROACH = Object.freeze({
  CLAMP: 'clamp',
  CUT: 'cut',
});

export const HANDLE_MODE = Object.freeze({
  MIRRORED: 'mirrored',
  BROKEN: 'broken',
});

export const COLOR_MODE = Object.freeze({
  BLACK: 'black',
  RANDOM: 'random',
});

export const PRESSURE_CONTROL = Object.freeze({
  SIZE: 'size',
  OPACITY: 'opacity',
});
