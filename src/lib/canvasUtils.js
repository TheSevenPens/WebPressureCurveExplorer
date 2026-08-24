import {
  PAD_LEFT, PAD_BOTTOM, PAD_TOP, PAD_RIGHT,
  X_LABEL_SPACING, Y_LABEL_SPACING,
  X_AXIS_LABEL_SPACING, Y_AXIS_LABEL_SPACING,
} from './canvasConstants';

export function drawBackground(ctx, width, height, plotW, plotH) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#f7f7fb';
  ctx.fillRect(PAD_LEFT, PAD_TOP, plotW, plotH);
}

export function drawGrid(ctx, plotW, plotH) {
  ctx.strokeStyle = '#ebebf4';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const gx = PAD_LEFT + (i / 4) * plotW;
    const gy = PAD_TOP + (i / 4) * plotH;

    ctx.beginPath();
    ctx.moveTo(gx, PAD_TOP);
    ctx.lineTo(gx, PAD_TOP + plotH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, gy);
    ctx.lineTo(PAD_LEFT + plotW, gy);
    ctx.stroke();
  }
}

export function drawLabels(ctx, width, height, plotW, plotH, options = {}) {
  const {
    xAxisLabel = 'INPUT',
    yAxisLabel = 'OUTPUT',
    formatXLabel = (i) => (i * 0.25).toFixed(2).replace(/\.?0+$/, ''),
    formatYLabel = (i) => (i * 0.25).toFixed(2).replace(/\.?0+$/, ''),
  } = options;

  ctx.fillStyle = '#000000';
  ctx.font = '10px Consolas, monospace';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i += 1) {
    const gx = Math.round(PAD_LEFT + (i / 4) * plotW);
    ctx.fillText(formatXLabel(i), gx, Math.round(PAD_TOP + plotH + X_LABEL_SPACING));
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i += 1) {
    const gy = Math.round(PAD_TOP + plotH - (i / 4) * plotH);
    ctx.fillText(formatYLabel(i), Math.round(PAD_LEFT - Y_LABEL_SPACING), gy);
  }

  ctx.fillStyle = '#000000';
  ctx.font = "10px 'Google Sans', 'Segoe UI', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(xAxisLabel, Math.round(PAD_LEFT + plotW / 2), Math.round(height - X_AXIS_LABEL_SPACING));

  ctx.save();
  ctx.translate(Math.round(Y_AXIS_LABEL_SPACING), Math.round(PAD_TOP + plotH / 2));
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(yAxisLabel, 0, 0);
  ctx.restore();
}

export function drawIndicator(ctx, plotW, plotH, inputValue, outputValue, solidColor, fadedColor) {
  const dotX = PAD_LEFT + inputValue * plotW;
  const dotY = PAD_TOP + plotH - outputValue * plotH;

  ctx.strokeStyle = fadedColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(dotX, PAD_TOP + plotH);
  ctx.lineTo(dotX, dotY);
  ctx.moveTo(PAD_LEFT, dotY);
  ctx.lineTo(dotX, dotY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = solidColor;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
  ctx.fill();
}

const RESPONSE_INDICATOR_RADIUS = 3;

/**
 * Indicator for the response chart, where X is looked up from Y on the
 * measured polyline rather than computed from the input value. Smaller dot
 * than drawIndicator, since the response curve is denser.
 */
export function drawResponseIndicator(ctx, plotH, cx, yNorm, solidColor, guideColor) {
  const cy = PAD_TOP + plotH - yNorm * plotH;

  ctx.strokeStyle = guideColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD_LEFT, cy);
  ctx.lineTo(cx, cy);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, PAD_TOP + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = solidColor;
  ctx.beginPath();
  ctx.arc(cx, cy, RESPONSE_INDICATOR_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}
