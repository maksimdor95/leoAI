import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { ListeningWaveCanvas, type SyntheticMood } from '@/components/chat/ListeningWaveCanvas';

export type VoiceIndicatorMode = 'idle' | 'typing' | 'listening' | 'speaking';

type VoiceIndicatorProps = {
  isActive: boolean;
  isMuted?: boolean;
  mode: VoiceIndicatorMode;
  ttsBeatAtRef: RefObject<number>;
  assistantLevelRef?: RefObject<number>;
  /** Только анимированная волна; центральный шар и кольца скрыты */
  waveOnly?: boolean;
};

const RING_COUNT = 4;
const RIPPLE_PERIOD_S = 2.75;
const WAVE_STEPS = 140;
const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 148;
const WAVE_BASELINE = VIEWBOX_HEIGHT / 2;
const CENTER_X = VIEWBOX_WIDTH / 2;

/** Слои «ленты» как на референсе: смещение по Y (единицах viewBox), прозрачность, толщина */
const RIBBON_LAYERS: { y: number; strokeWidth: number; opacity: number; blur?: number }[] = [
  { y: -6, strokeWidth: 0.95, opacity: 0.22 },
  { y: -3.2, strokeWidth: 1.25, opacity: 0.38 },
  { y: 0, strokeWidth: 2.35, opacity: 1 },
  { y: 3.2, strokeWidth: 1.25, opacity: 0.38 },
  { y: 6, strokeWidth: 0.95, opacity: 0.22 },
];

function buildWavePoints(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const stepX = VIEWBOX_WIDTH / WAVE_STEPS;

  pts.push({ x: 0, y: WAVE_BASELINE });

  for (let i = 1; i < WAVE_STEPS; i += 1) {
    const t = i / WAVE_STEPS;
    const centerBoost = Math.exp(-Math.pow((t - 0.5) / 0.21, 2));
    const texture = 0.62 + 0.38 * Math.abs(Math.sin(i * 1.07 + 0.35));
    const amp = (8 + 48 * centerBoost) * texture;
    // Плавная «несущая» вместо жёсткого sign по сегментам — меньше зубцов и мерцания при анимации
    const x = i * stepX;
    const y = WAVE_BASELINE + Math.sin(i * 0.095 + 0.2) * amp * 0.82;
    pts.push({ x, y });
  }

  pts.push({ x: VIEWBOX_WIDTH, y: WAVE_BASELINE });
  return pts;
}

function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }
  return d;
}

function buildPathsFromSkeleton(
  skeleton: { x: number; dy: number }[],
  t: number,
  now: number,
  mode: VoiceIndicatorMode,
  isMutedVisual: boolean,
  ttsBeatAt: number
): { main: string; mirror: string } {
  const beatAge = (now - ttsBeatAt) / 1000;
  const beatEnvelope = Math.max(0, 1 - beatAge / 0.34);

  const breathe = 0.92 + 0.08 * Math.sin(t * (mode === 'typing' ? 3.6 : 2.35));
  let scale = 1;
  if (mode === 'typing') scale = 1.035 + 0.045 * Math.sin(t * 5.2);
  if (mode === 'listening') scale = 1.02 + 0.05 * Math.sin(t * 3.4);
  if (mode === 'idle') scale = 0.93 + 0.07 * Math.sin(t * 1.75);

  if (isMutedVisual) {
    if (mode === 'typing' || mode === 'listening') scale *= 0.92;
    else scale *= 0.32;
  }

  const beatStrength = beatEnvelope * (mode === 'typing' ? 0.32 : 0.45);

  const speechBoost = mode === 'listening' ? 1.15 : mode === 'typing' ? 1.08 : 0.85;

  const formantGain = mode === 'idle' ? 0.28 : mode === 'typing' ? 0.55 : mode === 'listening' ? 0.85 : 1;

  const mainPts: { x: number; y: number }[] = skeleton.map((s, i) => {
    const u = s.x / VIEWBOX_WIDTH;
    const env = Math.exp(-Math.pow((u - 0.5) / 0.36, 2));

    const jitter =
      mode === 'typing'
        ? 1.15 * Math.sin(t * 6.2 + i * 0.22) + 0.45 * Math.sin(t * 10.5 + i * 0.31)
        : mode === 'listening'
          ? 1.25 * Math.sin(t * 6.2 + i * 0.21) + 0.45 * Math.sin(t * 9.5 + i * 0.38)
          : 0.38 * Math.sin(t * 2.8 + i * 0.12);
    const formant =
      formantGain * speechBoost * 1.35 * Math.sin(t * 9.2 + u * 18) * Math.sin(i * 0.08 + t * 4.2);
    const bumpScale = mode === 'typing' ? 34 : mode === 'idle' ? 22 : 46;
    const bump = beatStrength * env * bumpScale * Math.sin(u * Math.PI * 7 + t * 5.4);
    const y =
      WAVE_BASELINE +
      s.dy * breathe * scale * speechBoost +
      jitter +
      bump +
      formant;
    return { x: s.x, y };
  });

  const mirrorPts = mainPts.map((p) => ({
    x: p.x,
    y: WAVE_BASELINE + (WAVE_BASELINE - p.y) * 0.42,
  }));

  return { main: pointsToPath(mainPts), mirror: pointsToPath(mirrorPts) };
}

export function VoiceIndicator({
  isActive,
  isMuted,
  mode,
  ttsBeatAtRef,
  assistantLevelRef,
  waveOnly = false,
}: VoiceIndicatorProps) {
  const paused = !isActive || !!isMuted;
  const id = useId().replace(/:/g, '');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const skeleton = useMemo(() => {
    return buildWavePoints().map((p) => ({ x: p.x, dy: p.y - WAVE_BASELINE }));
  }, []);

  const initialPaths = useMemo(() => {
    const pts = buildWavePoints();
    const main = pointsToPath(pts);
    const mirrorPts = pts.map((p) => ({
      x: p.x,
      y: WAVE_BASELINE + (WAVE_BASELINE - p.y) * 0.42,
    }));
    return { main, mirror: pointsToPath(mirrorPts) };
  }, []);

  const gidStroke = `vw-stroke-${id}`;
  const gidMask = `vw-mask-${id}`;
  const gidFade = `vw-fade-${id}`;
  const gidGlowGrad = `vw-glow-${id}`;

  const mirrorRef = useRef<SVGPathElement | null>(null);
  const glowRef = useRef<SVGPathElement | null>(null);
  const ribbonRefs = useRef<(SVGPathElement | null)[]>([]);

  const modeRef = useRef(mode);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(!!isMuted);
  const waveOnlyRef = useRef(waveOnly);
  const ribbonCanvasActiveRef = useRef(false);
  modeRef.current = mode;
  pausedRef.current = paused;
  mutedRef.current = !!isMuted;
  waveOnlyRef.current = waveOnly;

  const [micListenMode, setMicListenMode] = useState<'canvas' | 'svg'>('canvas');

  useEffect(() => {
    if (mode === 'listening') {
      setMicListenMode('canvas');
    }
  }, [mode]);

  const showMicRibbon =
    mode === 'listening' && !paused && !reduceMotion && micListenMode === 'canvas';

  const showAssistantRibbon = waveOnly && mode === 'speaking' && !!assistantLevelRef;
  const syntheticRibbon =
    waveOnly && !showAssistantRibbon && (mode === 'speaking' || mode === 'typing' || mode === 'idle');

  const canvasRibbon = showMicRibbon || syntheticRibbon;

  const onListenMicFailed = useCallback(() => {
    setMicListenMode('svg');
  }, []);

  const syntheticMood: SyntheticMood =
    mode === 'typing' ? 'typing' : mode === 'idle' ? 'idle' : 'speaking';

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();

    const drawFrame = (now: number, t: number) => {
      const m = modeRef.current;
      if (ribbonCanvasActiveRef.current) return;

      const isPa = pausedRef.current;
      const mut = mutedRef.current;
      const ttsAt = ttsBeatAtRef.current ?? 0;
      const freezeTime = isPa || (mut && m === 'idle');
      const tUse = freezeTime ? 0 : t;

      const { main, mirror } = buildPathsFromSkeleton(skeleton, tUse, now, m, mut, ttsAt);

      mirrorRef.current?.setAttribute('d', mirror);
      glowRef.current?.setAttribute('d', main);
      RIBBON_LAYERS.forEach((_, i) => {
        ribbonRefs.current[i]?.setAttribute('d', main);
      });

      const centerEl = ribbonRefs.current[2];
      if (centerEl) {
        if (!freezeTime && !reduceMotion) {
          const dashOff = (t * 72) % 1000;
          centerEl.style.strokeDashoffset = String(-dashOff);
        } else {
          centerEl.style.strokeDashoffset = '0';
        }
      }
    };

    if (reduceMotion) {
      raf = requestAnimationFrame((now) => drawFrame(now, 0));
      return () => cancelAnimationFrame(raf);
    }

    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      drawFrame(now, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [skeleton, ttsBeatAtRef, reduceMotion]);

  ribbonCanvasActiveRef.current = canvasRibbon;

  return (
    <div className="voice-orb-wrap flex w-full justify-center">
      <div
        className={`voice-stage ${
          canvasRibbon ? 'voice-stage--listening-canvas' : 'voice-stage--raf'
        } ${waveOnly ? 'voice-stage--wave-only' : ''} ${paused ? 'voice-orb--paused' : ''}`}
        aria-hidden="true"
      >
        <div className="voice-stage-wave">
          {canvasRibbon ? (
            <ListeningWaveCanvas
              active
              drive={showMicRibbon ? 'microphone' : showAssistantRibbon ? 'external' : 'synthetic'}
              syntheticMood={syntheticMood}
              paused={paused}
              reducedMotion={reduceMotion}
              externalLevelRef={showAssistantRibbon ? assistantLevelRef : undefined}
              onStreamFailed={showMicRibbon ? onListenMicFailed : undefined}
            />
          ) : (
          <svg
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="voice-waveline"
            role="presentation"
            fill="none"
          >
            <defs>
              <linearGradient
                id={gidStroke}
                gradientUnits="userSpaceOnUse"
                x1="-320"
                y1="0"
                x2={String(VIEWBOX_WIDTH + 320)}
                y2="0"
              >
                <animate
                  attributeName="x1"
                  values={`${-320};120;${-320}`}
                  dur="7s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="x2"
                  values={`${VIEWBOX_WIDTH + 320};${VIEWBOX_WIDTH - 80};${VIEWBOX_WIDTH + 320}`}
                  dur="7s"
                  repeatCount="indefinite"
                />
                <stop offset="0%" stopColor="#022c22" stopOpacity="1" />
                <stop offset="14%" stopColor="#047857" stopOpacity="1" />
                <stop offset="32%" stopColor="#10b981" stopOpacity="1" />
                <stop offset="48%" stopColor="#d1fae5" stopOpacity="1" />
                <stop offset="58%" stopColor="#6ee7b7" stopOpacity="1" />
                <stop offset="76%" stopColor="#34d399" stopOpacity="1" />
                <stop offset="92%" stopColor="#059669" stopOpacity="1" />
                <stop offset="100%" stopColor="#064e3b" stopOpacity="1" />
              </linearGradient>
              <linearGradient id={gidGlowGrad} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.08" />
                <stop offset="45%" stopColor="#a7f3d0" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient
                id={gidFade}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2={String(VIEWBOX_WIDTH)}
                y2="0"
              >
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.04" stopColor="#fff" stopOpacity="1" />
                <stop offset="0.96" stopColor="#fff" stopOpacity="1" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask
                id={gidMask}
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width={VIEWBOX_WIDTH}
                height={VIEWBOX_HEIGHT}
              >
                <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={`url(#${gidFade})`} />
              </mask>
            </defs>

            <g mask={`url(#${gidMask})`}>
              <path
                ref={mirrorRef}
                d={initialPaths.mirror}
                fill="none"
                className="voice-waveline-path voice-waveline-path--mirror voice-waveline-path--ribbon-mirror"
                pathLength={1000}
              />
              <path
                ref={glowRef}
                d={initialPaths.main}
                fill="none"
                className="voice-waveline-path voice-waveline-path--glow voice-waveline-path--ribbon-glow"
                stroke={`url(#${gidGlowGrad})`}
                pathLength={1000}
              />
              {RIBBON_LAYERS.map((layer, i) => (
                <path
                  key={i}
                  ref={(el) => {
                    ribbonRefs.current[i] = el;
                  }}
                  d={initialPaths.main}
                  fill="none"
                  className={`voice-waveline-path voice-waveline-path--ribbon ${
                    i === 2 ? 'voice-waveline-path--ribbon-center' : ''
                  }`}
                  transform={`translate(0, ${layer.y})`}
                  stroke={`url(#${gidStroke})`}
                  strokeWidth={layer.strokeWidth}
                  strokeOpacity={layer.opacity}
                  pathLength={1000}
                  style={
                    i === 2
                      ? {
                          strokeDasharray: '95 905',
                        }
                      : undefined
                  }
                />
              ))}
              {!waveOnly ? (
                <>
                  <circle cx={CENTER_X} cy={WAVE_BASELINE} r={9} className="voice-waveline-node" />
                  <circle cx={CENTER_X} cy={WAVE_BASELINE} r={4.2} className="voice-waveline-node-core" />
                </>
              ) : null}
            </g>
          </svg>
          )}
        </div>

        {!waveOnly ? (
          <div className="voice-stage-center">
            <div className="voice-orb-ambient" />

            {Array.from({ length: RING_COUNT }).map((_, i) => (
              <span
                key={i}
                className="voice-orb-ring"
                style={{
                  animationDelay: `${(i * RIPPLE_PERIOD_S) / RING_COUNT}s`,
                }}
              />
            ))}

            <div className="voice-orb-core">
              <span className="voice-orb-core-highlight" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
