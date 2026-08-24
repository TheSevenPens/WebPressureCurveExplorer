import { timestampedFileName } from './fileNames';

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/**
 * Copy a canvas to the clipboard as a PNG. Resolves true on success and false
 * if the write was refused, so callers can show feedback.
 */
export function copyPngToClipboard(canvasEl) {
  return new Promise((resolve) => {
    canvasEl.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        resolve(true);
      } catch (error) {
        console.error('Clipboard write failed:', error);
        resolve(false);
      }
    }, 'image/png');
  });
}

/** Download a canvas, with a local-time stamp in the file name. */
export function downloadCanvas(canvasEl, baseName, mime = 'image/png', quality) {
  const extension = EXTENSIONS[mime] ?? 'png';
  const link = document.createElement('a');
  link.download = timestampedFileName(baseName, extension);
  link.href = canvasEl.toDataURL(mime, quality);
  link.click();
}

/**
 * Copy onto an opaque white background. The chart draws on transparency, and
 * an exported image that inherits whatever it is pasted onto is unhelpful.
 */
export function flattenOntoWhite(sourceCanvas) {
  const flattened = document.createElement('canvas');
  flattened.width = sourceCanvas.width;
  flattened.height = sourceCanvas.height;

  const ctx = flattened.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, flattened.width, flattened.height);
  ctx.drawImage(sourceCanvas, 0, 0);

  return flattened;
}
