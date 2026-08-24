# Pressure Curves

This document details the pressure curve types available in WebPressureExplorer, their settings, and the math behind each.

## Overview

A pressure curve is a function `f(x) -> y` where:
- **x** = raw pen pressure input (0 to 1)
- **y** = transformed output pressure (0 to 1)

The output drives brush size, opacity, or other pressure-dependent parameters in drawing applications. Different curve shapes give different drawing "feels" — a concave curve makes light strokes more sensitive, while a convex curve requires more force for the same effect.

## Common settings

These settings apply to the **extended** and **sigmoid** curve types. The
**basic** curve uses the same math but exposes only CurveAmount, pinning the
input and output ranges to 0-1 and the min approach to clamp:

| Setting | Range | Description |
|---|---|---|
| InputMinimum | 0-1 | Below this input value, output is clamped (or cut to zero). Controlled by the min control node's X position. |
| InputMaximum | 0-1 | Above this input value, output is clamped to the maximum. Controlled by the max control node's X position. |
| OutputMinimum (minimum) | 0-1 | The output value at the min control node. Controlled by the min control node's Y position. |
| OutputMaximum (maximum) | 0-1 | The output value at the max control node. Controlled by the max control node's Y position. |
| CurveAmount (softness) | -0.9 to 0.9 | Controls the curve shape. Positive = concave (lighter feel), negative = convex (heavier feel), zero = linear. |
| Min Approach | clamp / cut | How the curve behaves below InputMinimum (see below). |
| TransitionWidth | 0-0.5 | Cubic Hermite smoothing at the boundaries (currently hidden in UI). |

### Min approach modes

Controls the curve segment from x=0 to x=InputMinimum:

- **Clamp** (default): Output holds at OutputMinimum across the entire range. The curve is `(0, OutputMinimum) -> (InputMinimum, OutputMinimum)`.
- **Cut**: Output is zero until InputMinimum, then jumps up. The curve is `(0, 0) -> (InputMinimum, 0) -> (InputMinimum, OutputMinimum)`.

## Curve types

### Passthrough

**Pass-through.** Output equals input: `f(x) = x`.

Draws a straight diagonal line from (0,0) to (1,1). No settings apply. Useful as a baseline to see raw pen behavior.

### Flat

**Constant output.** `f(x) = flatLevel` for all inputs.

| Setting | Range | Description |
|---|---|---|
| Height (flatLevel) | 0-1 | The constant output value |

Draws a horizontal line. Every input pressure produces the same output.

### Basic and Extended

**Power curve.** The core curve shape is a power function applied to the normalized input. Both types run identical math; they differ only in the controls the UI exposes.

- **Basic** shows only the CurveAmount slider. Selecting it resets InputMinimum/OutputMinimum to 0, InputMaximum/OutputMaximum to 1, and Min Approach to clamp, so the curve always spans the full range and the chart shows no draggable nodes.
- **Extended** additionally exposes the input/output range via draggable chart nodes, a read-only node values table, and the Min Approach radio buttons.

#### Math

1. **Normalize** the input to the [InputMinimum, InputMaximum] range:
   ```
   xNorm = clamp((x - inputMinimum) / (inputMaximum - inputMinimum), 0, 1)
   ```

2. **Compute exponent** from softness:
   ```
   if softness >= 0:
     exponent = 1 - softness
   else:
     exponent = 1 / (1 + softness)
   ```
   - softness = 0: exponent = 1 (linear)
   - softness = 0.5: exponent = 0.5 (square root, concave)
   - softness = -0.5: exponent = 2 (quadratic, convex)

3. **Apply power law:**
   ```
   curved = xNorm ^ exponent
   ```

4. **Scale to output range:**
   ```
   output = minimum + curved * (maximum - minimum)
   ```

#### Behavior
- **softness > 0** (concave): Light pressure is more sensitive. The curve rises steeply at first, then flattens. Good for detail work.
- **softness < 0** (convex): Light pressure is less sensitive. The curve starts flat, then rises steeply. Gives more control in the light-pressure range.
- **softness = 0** (linear): Straight line from min to max.

### Sigmoid

**S-curve.** Exposes the same range and Min Approach controls as Extended. Uses a logistic function for a smooth S-shaped transition. Compresses both the light and heavy ends while expanding the midrange.

#### Math

1. **Normalize** the input (same as basic/extended).

2. **Compute steepness:**
   ```
   k = softness * 14
   ```
   If `|k| < 0.01`, falls back to linear (`curved = xNorm`).

3. **Apply logistic function:**
   ```
   sig(t) = 1 / (1 + exp(-k * (t - 0.5)))
   s0 = sig(0)
   s1 = sig(1)
   curved = (sig(xNorm) - s0) / (s1 - s0)
   ```
   The normalization by `s0` and `s1` ensures the output maps cleanly to [0, 1].

4. **Scale to output range** (same as basic/extended).

#### Behavior
- **softness > 0**: Standard S-curve. Light and heavy pressure are compressed; midrange is expanded. The higher the softness, the steeper the S.
- **softness < 0**: Inverted S-curve. Midrange is compressed; extremes are expanded.
- **softness = 0**: Linear (same as basic/extended at softness=0).

### Bezier

**Custom cubic bezier curve.** Users define 2-16 anchor points with adjustable control handles. Provides complete freedom to shape the pressure response.

#### Points

Each bezier point has:
- `(x, y)` — anchor position on the curve
- `(inX, inY)` — incoming control handle (influences the curve arriving at this point)
- `(outX, outY)` — outgoing control handle (influences the curve leaving this point)
- `handleMode` — `'broken'` (handles move independently) or `'mirrored'` (handles are symmetric around the anchor)

Points are sorted by X. The first point is pinned to x=0 and the last to x=1.

#### Math

Between each pair of adjacent anchor points, a cubic bezier segment is defined:
- **P0** = current anchor
- **C0** = current anchor's outgoing handle `(outX, outY)`
- **C1** = next anchor's incoming handle `(inX, inY)`
- **P1** = next anchor

The cubic bezier formula:
```
B(t) = (1-t)^3 * P0 + 3*(1-t)^2*t * C0 + 3*(1-t)*t^2 * C1 + t^3 * P1
```

To evaluate the curve at a given input x:
1. Find the segment where `P0.x <= x <= P1.x`
2. Binary search (28 iterations) for the parameter `t` where `B(t).x = x`
3. Return `B(t).y`

#### Normalization

Points are automatically normalized on every change:
- Values clamped to [0, 1]
- Sorted by X
- First point forced to x=0, last to x=1
- Missing endpoints auto-generated
- Handle X values constrained to stay within adjacent anchor X bounds
- Endpoint handles forced to their anchor position (no overshoot)

## Boundary transition smoothing

When `transitionWidth > 0` (currently hidden in the UI), cubic Hermite interpolation smooths the transition at the boundaries of the input range to avoid sharp corners where the flat clamped segments meet the curve.

```
cubicHermite(t, y0, m0, y1, m1) =
  (2t^3 - 3t^2 + 1)*y0 + (t^3 - 2t^2 + t)*m0 +
  (-2t^3 + 3t^2)*y1 + (t^3 - t^2)*m1
```

Applied at both the minimum boundary (`xNorm < transitionWidth`) and maximum boundary (`xNorm > 1 - transitionWidth`), blending between the clamped flat value and the curve with matching slope continuity.

## Pressure processing pipeline

The full pipeline from raw pen input to final output:

```
Raw pen pressure (event.pressure, 0-1)
  |
  v
[EMA smoothing]  <-- if smoothingOrder = "smooth-then-curve"
  |
  v
[applyPressureCurve]  <-- curve type + all settings
  |
  v
[EMA smoothing]  <-- if smoothingOrder = "curve-then-smooth"
  |
  v
Output pressure (0-1) --> brush size or opacity
```

The order defaults to curve-then-smooth.

Only pressure is smoothed. Pointer coordinates are used exactly as the pointer
event delivers them.

EMA (Exponential Moving Average) smoothing:
```
smoothed = smoothed + alpha * (raw - smoothed)
alpha = 1 - emaSmoothing
```

When `emaSmoothing = 0`, alpha = 1, so output = input (no smoothing). As emaSmoothing approaches 0.99, the output becomes increasingly smoothed/lagged.
