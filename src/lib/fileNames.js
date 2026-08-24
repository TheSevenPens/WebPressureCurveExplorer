// Local-time stamp for export file names: YYYY-MM-DD_HHMMSS.
// Sorts chronologically and uses only characters that are legal in file names
// on Windows, macOS and Linux.
export function fileNameTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${day}_${time}`;
}

export function timestampedFileName(baseName, extension) {
  return `${baseName}_${fileNameTimestamp()}.${extension}`;
}
