'use client';

import { useEffect, useState } from 'react';

/** Short vertical labels for the hero: LEO + rotating suffix. */
export const HERO_BRAND_SUFFIXES = [
  'Med',
  'IT',
  'Tech',
  'HR',
  'Design',
  'Sales',
  'Finance',
  'Legal',
  'Product',
  'Marketing',
  'Data',
] as const;

/** Hero suffix cadence — 20s felt “stuck” on Med; keep animation readable. */
const ROTATE_MS = 3_500;
const ANIM_MS = 560;

function pickRandomSuffix(current: string): string {
  const pool = HERO_BRAND_SUFFIXES.filter((word) => word !== current);
  return pool[Math.floor(Math.random() * pool.length)] ?? current;
}

type Phase = 'idle' | 'out' | 'in';

export function useHeroBrandRotation() {
  const [suffix, setSuffix] = useState<string>(HERO_BRAND_SUFFIXES[0]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    let outTimer: number | undefined;
    let inTimer: number | undefined;

    const id = window.setInterval(() => {
      if (reducedMotion) {
        setSuffix((prev) => pickRandomSuffix(prev));
        return;
      }

      setPhase('out');
      outTimer = window.setTimeout(() => {
        setSuffix((prev) => pickRandomSuffix(prev));
        setPhase('in');
        inTimer = window.setTimeout(() => setPhase('idle'), ANIM_MS);
      }, ANIM_MS);
    }, ROTATE_MS);

    return () => {
      window.clearInterval(id);
      if (outTimer !== undefined) window.clearTimeout(outTimer);
      if (inTimer !== undefined) window.clearTimeout(inTimer);
    };
  }, [reducedMotion]);

  return { suffix, phase };
}

type HeroBrandRotatorProps = {
  suffix: string;
  phase: Phase;
  /** Theme-specific text class (gradient / color). */
  textClassName: string;
};

export function HeroBrandRotator({ suffix, phase, textClassName }: HeroBrandRotatorProps) {
  const tileClass =
    phase === 'out'
      ? 'landing-hero-brand-tile landing-hero-brand-tile--out'
      : phase === 'in'
        ? 'landing-hero-brand-tile landing-hero-brand-tile--in'
        : 'landing-hero-brand-tile';

  return (
    <span className="landing-hero-brand-slot">
      <span key={suffix} className={`${tileClass} ${textClassName}`}>
        {suffix}
      </span>
    </span>
  );
}
