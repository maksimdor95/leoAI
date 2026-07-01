type WaveAnimationLoopOptions = {
  /** If no paint for this long, force a tick via setInterval (ms). */
  stallMs?: number;
  /** Interval poll while checking for stalls (ms). */
  tickMs?: number;
};

/**
 * Wave paint loop for mobile browsers (incl. Yandex) where rAF may fire once
 * and then stall until a user gesture or background tab resume.
 */
export function startWaveAnimationLoop(
  paint: (nowMs: number) => void,
  opts: WaveAnimationLoopOptions = {}
): () => void {
  const stallMs = opts.stallMs ?? 280;
  const tickMs = opts.tickMs ?? 33;

  let cancelled = false;
  let rafId = 0;
  let lastPaintMs = 0;

  const doPaint = (nowMs: number) => {
    lastPaintMs = nowMs;
    paint(nowMs);
  };

  const rafLoop = (now: number) => {
    if (cancelled) return;
    doPaint(now);
    rafId = requestAnimationFrame(rafLoop);
  };

  const kick = () => {
    if (cancelled) return;
    doPaint(performance.now());
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(rafLoop);
  };

  lastPaintMs = performance.now();
  rafId = requestAnimationFrame(rafLoop);

  const intervalId = window.setInterval(() => {
    if (cancelled) return;
    const now = performance.now();
    if (now - lastPaintMs >= stallMs) {
      doPaint(now);
    }
  }, tickMs);

  const onVisibility = () => {
    if (document.visibilityState === 'visible') kick();
  };

  window.addEventListener('pointerdown', kick, { passive: true });
  window.addEventListener('touchstart', kick, { passive: true });
  window.addEventListener('focus', kick);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
    window.clearInterval(intervalId);
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('touchstart', kick);
    window.removeEventListener('focus', kick);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/** Map wall-clock time to animation phase; honors reduced-motion without freezing. */
export function waveAnimTime(nowMs: number, reducedMotion: boolean): number {
  const t = nowMs / 1000;
  return reducedMotion ? t * 0.14 : t;
}
