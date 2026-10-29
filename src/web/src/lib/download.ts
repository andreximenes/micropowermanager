/** Hands a downloaded file to the browser's save flow. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking in the same task can cancel the download before the browser has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
