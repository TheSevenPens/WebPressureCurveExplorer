<script>
  import { SMOOTHING_ORDER } from './uiConstants';

  export let params;

  function patchParams(nextValues) {
    params = { ...params, ...nextValues };
  }
</script>

<div class="param-group">
  <div class="param">
    <label>
      <input
        type="radio"
        name="smoothingOrder"
        checked={params.smoothingOrder === SMOOTHING_ORDER.SMOOTH_THEN_CURVE}
        on:change={() => patchParams({ smoothingOrder: SMOOTHING_ORDER.SMOOTH_THEN_CURVE })}
      />
      Smooth then curve
    </label>
    <label>
      <input
        type="radio"
        name="smoothingOrder"
        checked={params.smoothingOrder === SMOOTHING_ORDER.CURVE_THEN_SMOOTH}
        on:change={() => patchParams({ smoothingOrder: SMOOTHING_ORDER.CURVE_THEN_SMOOTH })}
      />
      Curve then smooth
    </label>
  </div>
</div>
