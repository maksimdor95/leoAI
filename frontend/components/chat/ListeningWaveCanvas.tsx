'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { applyCanvasSize } from '@/lib/canvasLayout';
import { startWaveAnimationLoop, waveAnimTime } from '@/lib/waveAnimationLoop';

export type RibbonDrive = 'microphone' | 'synthetic' | 'external';
export type SyntheticMood = 'idle' | 'typing' | 'speaking';

type ListeningWaveCanvasProps = {
  active: boolean;
  /** Микрофон (диктовка) или плавная «фиктивная» огибающая (TTS / набор / ожидание) */
  drive?: RibbonDrive;
  syntheticMood?: SyntheticMood;
  paused?: boolean;
  reducedMotion?: boolean;
  externalLevelRef?: RefObject<number>;
  onStreamFailed?: () => void;
  /** Canvas layout/context failed — parent may fall back to SVG wave */
  onCanvasBroken?: () => void;
};

function pickAudioContext(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

function dprScale(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return 1;
  return canvas.width / rect.width;
}

function layerRibbonGradient(
  c: CanvasRenderingContext2D,
  w: number,
  layerAlpha: number,
  strandWeight: number,
  hume: boolean
): CanvasGradient {
  const grd = c.createLinearGradient(0, 0, w, 0);
  const a = layerAlpha * (0.35 + 0.65 * strandWeight);
  const peak = Math.min(1, layerAlpha * (0.55 + 1.15 * strandWeight));
  if (hume) {
    grd.addColorStop(0, `rgba(252, 224, 238, ${a * 0.75})`);
    grd.addColorStop(0.18, `rgba(192, 148, 228, ${a * 0.95})`);
    grd.addColorStop(0.38, `rgba(247, 187, 230, ${peak})`);
    grd.addColorStop(0.5, `rgba(255, 255, 255, ${Math.min(1, peak * 1.05)})`);
    grd.addColorStop(0.62, `rgba(255, 183, 96, ${peak * 0.92})`);
    grd.addColorStop(0.8, `rgba(192, 148, 228, ${a})`);
    grd.addColorStop(1, `rgba(255, 233, 207, ${a * 0.8})`);
    return grd;
  }
  grd.addColorStop(0, `rgba(4, 47, 46, ${a * 0.85})`);
  grd.addColorStop(0.22, `rgba(5, 150, 105, ${a * 1.05})`);
  grd.addColorStop(0.42, `rgba(167, 243, 208, ${peak})`);
  grd.addColorStop(0.5, `rgba(248, 250, 252, ${peak * 1.08})`);
  grd.addColorStop(0.58, `rgba(204, 251, 241, ${peak * 0.95})`);
  grd.addColorStop(0.78, `rgba(16, 185, 129, ${a})`);
  grd.addColorStop(1, `rgba(6, 78, 59, ${a * 0.9})`);
  return grd;
}

function ribbonBaseY(
  i: number,
  steps: number,
  w: number,
  mid: number,
  phase: number,
  freq: number,
  ampBase: number,
  t: number
): number {
  const u = i / steps;
  const env = Math.exp(-Math.pow((u - 0.5) / 0.33, 2));
  const wave =
    Math.sin(i * freq * 11 + phase) * 0.52 +
    Math.sin(i * freq * 21 + phase * 1.35) * 0.3 +
    Math.sin(i * freq * 5.5 + t * 0.95) * 0.2;
  return mid + wave * ampBase * env;
}

function syntheticLevel(t: number, mood: SyntheticMood, paused: boolean): number {
  if (paused) return 0.24;
  if (mood === 'speaking') {
    return 0.52 + 0.44 * (0.5 + 0.5 * Math.sin(t * 2.55)) * (0.52 + 0.48 * Math.sin(t * 4.35));
  }
  if (mood === 'typing') {
    return 0.4 + 0.38 * (0.5 + 0.5 * Math.sin(t * 2.02)) + 0.12 * Math.sin(t * 4.9);
  }
  return 0.26 + 0.26 * Math.sin(t * 0.92) + 0.12 * Math.sin(t * 1.65);
}

function humeDualPeakEnvelope(u: number): number {
  const edge = Math.pow(Math.sin(Math.PI * u), 0.82);
  const left = Math.exp(-Math.pow((u - 0.34) / 0.1, 2));
  const right = Math.exp(-Math.pow((u - 0.66) / 0.13, 2)) * 1.15;
  return edge * (0.1 + 0.9 * Math.max(left, right));
}

function paintRibbon(
  c: CanvasRenderingContext2D,
  cvs: HTMLCanvasElement,
  level: number,
  t: number,
  opts: { reducedMotion: boolean; hume: boolean }
): void {
  const w = cvs.width;
  const h = cvs.height;
  c.clearRect(0, 0, w, h);
  c.setTransform(1, 0, 0, 1, 0, 0);

  if (opts.hume) {
    c.fillStyle = '#fff9f3';
    c.fillRect(0, 0, w, h);
  }

  const tUse = waveAnimTime(t * 1000, opts.reducedMotion);
  const mid = h * 0.5;
  const steps = Math.min(220, Math.max(96, Math.floor(w / 4)));
  const hNorm = h / 108;
  const dpr = dprScale(cvs);

  const layers = opts.hume
    ? [
        { alpha: 0.1, amp: 0.72, fMul: 0.88, phase: 0, strandMul: 0.7 },
        { alpha: 0.14, amp: 0.82, fMul: 1, phase: 0.55, strandMul: 0.82 },
        { alpha: 0.2, amp: 0.92, fMul: 1.12, phase: 1.1, strandMul: 0.94 },
        { alpha: 0.26, amp: 1, fMul: 1.22, phase: 1.75, strandMul: 1 },
        { alpha: 0.32, amp: 1.05, fMul: 1.32, phase: 2.4, strandMul: 1.06 },
      ]
    : [
        { alpha: 0.13, amp: 0.88, fMul: 0.9, phase: 0, strandMul: 0.78 },
        { alpha: 0.18, amp: 0.95, fMul: 1.03, phase: 0.62, strandMul: 0.88 },
        { alpha: 0.24, amp: 1.02, fMul: 1.15, phase: 1.22, strandMul: 1 },
        { alpha: 0.32, amp: 1.08, fMul: 1.28, phase: 1.92, strandMul: 1.08 },
        { alpha: 0.4, amp: 1.12, fMul: 1.4, phase: 2.62, strandMul: 1.14 },
      ];

  const micMul = opts.hume
    ? 0.08 + level * 0.95
    : 0.12 + level * 1.28;
  const strandCount = opts.hume
    ? w > 1200
      ? 19
      : w > 700
        ? 17
        : w > 480
          ? 15
          : 13
    : w > 1200
      ? 15
      : w > 700
        ? 13
        : w > 480
          ? 11
          : 9;
  const halfStrands = (strandCount - 1) / 2;

  for (let li = 0; li < layers.length; li += 1) {
    const L = layers[li]!;
    const phase = tUse * (opts.hume ? 0.38 + li * 0.07 : 0.52 + li * 0.095) + L.phase;
    const freq = (0.0175 + li * 0.0032) * L.fMul;
    const ampBase = (opts.hume ? 5 + li * 4.2 : 7.5 + li * 6.2) * micMul * hNorm * L.amp * L.strandMul;

    const ys = new Float32Array(steps + 1);
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      let y = ribbonBaseY(i, steps, w, mid, phase, freq, ampBase, tUse);
      if (opts.hume) {
        y = mid + (y - mid) * humeDualPeakEnvelope(u);
      }
      ys[i] = y;
    }

    for (let s = 0; s < strandCount; s += 1) {
      const si = s - halfStrands;
      const weight = 1 - Math.abs(si) / (halfStrands + 0.01);
      const w2 = weight * weight;

      c.beginPath();
      const spread = si * (0.48 * dpr) * (1 + 0.042 * Math.sin(tUse * 1.1 + si * 0.32));
      for (let i = 0; i <= steps; i += 1) {
        const x = (i / steps) * w;
        const micro = 0.14 * dpr * Math.sin(i * 0.36 + tUse * 1.75 + si * 0.42);
        const y = ys[i]! + spread + micro;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }

      c.strokeStyle = layerRibbonGradient(c, w, L.alpha, w2, opts.hume);
      c.globalAlpha = opts.hume ? 0.08 + 0.72 * w2 : 0.12 + 0.88 * w2;
      c.lineWidth = (opts.hume ? 0.2 + 0.62 * w2 : 0.34 + 0.92 * w2) * dpr;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  for (let li = 0; li < 3; li += 1) {
    const phase = tUse * (0.45 + li * 0.085) + li * 1.05;
    const freq = (0.015 + li * 0.0026) * 1.04;
    const ampBase = (4.5 + li * 3.4) * micMul * hNorm * 0.58;
    const ys = new Float32Array(steps + 1);
    for (let i = 0; i <= steps; i += 1) {
      const y0 = ribbonBaseY(i, steps, w, mid, phase, freq, ampBase, tUse);
      ys[i] = 2 * mid - y0;
    }
    const strands = 5;
    const hh = (strands - 1) / 2;
    for (let s = 0; s < strands; s += 1) {
      const si = s - hh;
      const weight = 1 - Math.abs(si) / (hh + 0.01);
      const w2 = weight * weight;
      c.beginPath();
      const spread = si * 0.38 * dpr;
      for (let i = 0; i <= steps; i += 1) {
        const x = (i / steps) * w;
        const y = ys[i]! + spread;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = layerRibbonGradient(c, w, 0.11, w2, opts.hume);
      c.globalAlpha = 0.07 + 0.24 * w2;
      c.lineWidth = (0.3 + 0.42 * w2) * dpr;
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

export function ListeningWaveCanvas({
  active,
  drive = 'microphone',
  syntheticMood = 'idle',
  paused = false,
  reducedMotion = false,
  externalLevelRef,
  onStreamFailed,
  onCanvasBroken,
}: ListeningWaveCanvasProps) {
  const { settings } = useAppSettings();
  const humeThemeRef = useRef(settings.theme === 'hume-light');
  humeThemeRef.current = settings.theme === 'hume-light';
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<{
    ctx: AudioContext;
    stream: MediaStream;
    analyser: AnalyserNode;
    timeData: Float32Array;
    rmsEma: number;
  } | null>(null);
  const failRef = useRef(onStreamFailed);
  failRef.current = onStreamFailed;
  const brokenRef = useRef(onCanvasBroken);
  brokenRef.current = onCanvasBroken;
  const levelEmaRef = useRef(0.35);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const sync = () => applyCanvasSize(wrap, canvas, 2.5);
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      stopLoopRef.current?.();
      stopLoopRef.current = null;
      if (audioRef.current) {
        audioRef.current.stream.getTracks().forEach((tr) => tr.stop());
        void audioRef.current.ctx.close();
        audioRef.current = null;
      }
      return;
    }

    const cvs = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cvs || !wrap) return;

    let badLayoutFrames = 0;
    let reportedBroken = false;
    const reportBroken = () => {
      if (reportedBroken) return;
      reportedBroken = true;
      brokenRef.current?.();
    };
    const ensureLayout = () => {
      if (applyCanvasSize(wrap, cvs, 2.5)) {
        badLayoutFrames = 0;
        return true;
      }
      badLayoutFrames += 1;
      if (badLayoutFrames > 90) reportBroken();
      return false;
    };

    const startPaintLoop = (frame: (nowMs: number) => void) => {
      stopLoopRef.current?.();
      stopLoopRef.current = startWaveAnimationLoop(frame);
    };

    if (drive === 'synthetic') {
      let cancelled = false;
      startPaintLoop((nowMs) => {
        if (cancelled) return;
        if (!ensureLayout()) return;
        const c = cvs.getContext('2d');
        if (!c) {
          reportBroken();
          return;
        }
        const t = nowMs / 1000;
        const raw = syntheticLevel(t, syntheticMood, paused);
        levelEmaRef.current = levelEmaRef.current * 0.88 + raw * 0.12;
        const level = Math.min(1, levelEmaRef.current);
        paintRibbon(c, cvs, level, t, { reducedMotion, hume: humeThemeRef.current });
      });
      return () => {
        cancelled = true;
        stopLoopRef.current?.();
        stopLoopRef.current = null;
      };
    }

    if (drive === 'external') {
      let cancelled = false;
      startPaintLoop((nowMs) => {
        if (cancelled) return;
        if (!ensureLayout()) return;
        const c = cvs.getContext('2d');
        if (!c) {
          reportBroken();
          return;
        }
        const t = nowMs / 1000;
        const raw = Math.max(0, Math.min(1, externalLevelRef?.current ?? 0));
        levelEmaRef.current = levelEmaRef.current * 0.82 + raw * 0.18;
        paintRibbon(c, cvs, levelEmaRef.current, t, { reducedMotion, hume: humeThemeRef.current });
      });
      return () => {
        cancelled = true;
        stopLoopRef.current?.();
        stopLoopRef.current = null;
      };
    }

    let cancelled = false;
    let reportedFail = false;

    const fail = () => {
      if (reportedFail) return;
      reportedFail = true;
      failRef.current?.();
    };

    const setup = async () => {
      const AC = pickAudioContext();
      if (!AC) {
        fail();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }

        const ctx = new AC();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.88;
        const src = ctx.createMediaStreamSource(stream);
        src.connect(analyser);

        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* ignore */
          }
        }

        audioRef.current = {
          ctx,
          stream,
          analyser,
          timeData: new Float32Array(analyser.fftSize),
          rmsEma: 0,
        };
      } catch {
        fail();
        return;
      }

      startPaintLoop((nowMs) => {
        if (cancelled || !audioRef.current) return;
        if (!ensureLayout()) return;
        const c = cvs.getContext('2d');
        if (!c) {
          reportBroken();
          return;
        }

        const { analyser, timeData } = audioRef.current;
        analyser.getFloatTimeDomainData(timeData as Parameters<AnalyserNode['getFloatTimeDomainData']>[0]);

        let sum = 0;
        for (let i = 0; i < timeData.length; i += 1) {
          const v = timeData[i]!;
          sum += v * v;
        }
        const raw = Math.sqrt(sum / timeData.length);
        audioRef.current.rmsEma = audioRef.current.rmsEma * 0.78 + raw * 0.22;
        const rms = audioRef.current.rmsEma;
        const level = Math.min(1, Math.pow(rms * 5.5, 0.78));

        const t = nowMs / 1000;
        paintRibbon(c, cvs, level, t, { reducedMotion, hume: humeThemeRef.current });
      });
    };

    void setup();

    return () => {
      cancelled = true;
      stopLoopRef.current?.();
      stopLoopRef.current = null;
      if (audioRef.current) {
        audioRef.current.stream.getTracks().forEach((tr) => tr.stop());
        void audioRef.current.ctx.close();
        audioRef.current = null;
      }
    };
  }, [active, drive, syntheticMood, paused, reducedMotion, onStreamFailed, externalLevelRef, onCanvasBroken]);

  return (
    <div ref={wrapRef} className="voice-listening-canvas-wrap">
      <canvas ref={canvasRef} className="voice-listening-canvas" aria-hidden />
    </div>
  );
}
