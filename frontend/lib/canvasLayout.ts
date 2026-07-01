/** Sync canvas backing store + CSS size from parent layout (mobile-safe). */
export function applyCanvasSize(
  wrap: HTMLElement,
  canvas: HTMLCanvasElement,
  maxDpr = 2.5
): boolean {
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const { width, height } = wrap.getBoundingClientRect();
  if (width < 2 || height < 2) return false;

  const cw = Math.max(1, Math.floor(width * dpr));
  const ch = Math.max(1, Math.floor(height * dpr));
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  const cssW = `${width}px`;
  const cssH = `${height}px`;
  if (canvas.style.width !== cssW) canvas.style.width = cssW;
  if (canvas.style.height !== cssH) canvas.style.height = cssH;
  return true;
}
