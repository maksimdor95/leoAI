'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type HumeHeroWaveCanvasProps = {
  /** 0..1 — optional amplitude boost (TTS / mic) */
  level?: number;
  externalLevelRef?: RefObject<number>;
  paused?: boolean;
  reducedMotion?: boolean;
  /** >1 — крупнее волна в hero-баннере (разводящая) */
  heroScale?: number;
};

const HUME_BG_STOPS: [number, string][] = [
  [0, '#F0F0F0'],
  [0.4, '#F5F8E0'],
  [0.7, '#FFF0D8'],
  [1, '#EDD8F0'],
];

const STRAND_COUNT = 22;
const CROSS_STRAND_COUNT = 11;

function dprScale(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return 1;
  return canvas.width / rect.width;
}

/** Dual-hump envelope like hume.ai hero (peaks ~28% and ~72%) */
function humeEnvelope(u: number): number {
  const edge = Math.pow(Math.sin(Math.PI * u), 0.62);
  const left = Math.exp(-Math.pow((u - 0.28) / 0.11, 2));
  const right = Math.exp(-Math.pow((u - 0.72) / 0.13, 2)) * 0.96;
  return edge * (0.06 + 0.94 * Math.max(left, right));
}

function humeArcEnvelope(u: number): number {
  return Math.pow(Math.sin(Math.PI * u), 1.05) * Math.exp(-Math.pow((u - 0.58) / 0.38, 2));
}

function strokeGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  alpha: number
): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, `rgba(255, 183, 96, ${alpha * 0.72})`);
  g.addColorStop(0.22, `rgba(253, 186, 116, ${alpha * 0.85})`);
  g.addColorStop(0.38, `rgba(247, 187, 230, ${alpha * 0.95})`);
  g.addColorStop(0.5, `rgba(192, 148, 228, ${alpha})`);
  g.addColorStop(0.62, `rgba(247, 187, 230, ${alpha * 0.92})`);
  g.addColorStop(0.78, `rgba(255, 183, 96, ${alpha * 0.8})`);
  g.addColorStop(1, `rgba(255, 209, 163, ${alpha * 0.7})`);
  return g;
}

function paintHumeBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  for (const [stop, color] of HUME_BG_STOPS) {
    bg.addColorStop(stop, color);
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}

function drawStrandBundle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  opts: {
    strandCount: number;
    midY: number;
    ampMul: number;
    level: number;
    timeScale: number;
    phaseOffset: number;
    envelope: (u: number) => number;
    lineSpacing: number;
    shadowAlpha: number;
    freqBase: number;
    crossPhase?: boolean;
    heroScale?: number;
  }
): void {
  const dpr = dprScale(ctx.canvas);
  const steps = Math.max(120, Math.floor(w / 3));
  const scale = opts.heroScale ?? 1;
  const amp = h * (0.19 + 0.09 * opts.level) * opts.ampMul * scale;
  const half = (opts.strandCount - 1) / 2;
  const lineSpacing = opts.lineSpacing * (scale > 1 ? 0.72 : 1);

  for (let s = 0; s < opts.strandCount; s += 1) {
    const si = s - half;
    const weight = 1 - Math.abs(si) / (half + 0.5);
    const w2 = weight * weight;
    const phase = opts.phaseOffset + (s / opts.strandCount) * Math.PI * 2;

    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      const x = u * w;
      const env = opts.envelope(u);
      const tt = t * opts.timeScale;

      const wave =
        Math.sin(u * opts.freqBase * Math.PI * 2 + tt + phase * 0.55) * 0.46 +
        Math.sin(u * opts.freqBase * 3.1 * Math.PI * 2 + tt * 1.18 + phase * 0.3) * 0.28 +
        Math.sin(u * opts.freqBase * 1.65 * Math.PI * 2 - tt * 0.72 + phase * 0.18) * 0.18 +
        (opts.crossPhase
          ? Math.sin(u * 5.4 + tt * 0.9 + phase) * 0.12
          : Math.sin(u * 4.2 + tt * 0.65) * 0.1);

      const spread = si * lineSpacing * dpr * (0.35 + 0.65 * env);
      const micro = 0.22 * dpr * Math.sin(i * 0.28 + tt * 1.4 + si * 0.35);
      const y = opts.midY + env * wave * amp + spread + micro;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const alpha = 0.18 + 0.68 * w2;
    ctx.strokeStyle = strokeGradient(ctx, w, alpha);
    ctx.lineWidth = (0.65 + 0.95 * w2) * dpr;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = `rgba(192, 148, 228, ${opts.shadowAlpha * w2})`;
    ctx.shadowBlur = 2.2 * dpr;
    ctx.shadowOffsetY = 0.6 * dpr;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
}

function paintHumeHeroWave(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  t: number,
  level: number,
  heroScale = 1
): void {
  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  paintHumeBackground(ctx, w, h);

  const mid = h * 0.5;

  drawStrandBundle(ctx, w, h, t, {
    strandCount: STRAND_COUNT,
    midY: mid,
    ampMul: 1,
    level,
    timeScale: 0.55,
    phaseOffset: 0,
    envelope: humeEnvelope,
    lineSpacing: 0.48,
    shadowAlpha: 0.1,
    freqBase: 1.85,
    heroScale,
  });

  drawStrandBundle(ctx, w, h, t, {
    strandCount: CROSS_STRAND_COUNT,
    midY: h * 0.58,
    ampMul: 0.72,
    level,
    timeScale: 0.42,
    phaseOffset: Math.PI * 0.65,
    envelope: humeArcEnvelope,
    lineSpacing: 0.62,
    shadowAlpha: 0.08,
    freqBase: 1.75,
    crossPhase: true,
    heroScale,
  });
}

export function HumeHeroWaveCanvas({
  level = 0.35,
  externalLevelRef,
  paused = false,
  reducedMotion = false,
  heroScale = 1,
}: HumeHeroWaveCanvasProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = wrap.getBoundingClientRect();
      const cw = Math.max(1, Math.floor(width * dpr));
      const ch = Math.max(1, Math.floor(height * dpr));
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const levelEma = { v: levelRef.current };

    const draw = () => {
      if (cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const now = performance.now() / 1000;
      const t = reducedMotion ? 0 : now;
      const rawLevel = externalLevelRef?.current ?? levelRef.current;
      const targetLevel = paused ? 0.3 : rawLevel;
      levelEma.v = levelEma.v * 0.9 + targetLevel * 0.1;
      paintHumeHeroWave(ctx, canvas, t, Math.min(1, levelEma.v), heroScale);
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [paused, reducedMotion, externalLevelRef, heroScale]);

  return (
    <div ref={wrapRef} className="hume-hero-wave-wrap">
      <canvas ref={canvasRef} className="hume-hero-wave-canvas" aria-hidden />
    </div>
  );
}
