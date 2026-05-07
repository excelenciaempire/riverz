'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const OrbScene = dynamic(() => import('./OrbScene').then((m) => m.OrbScene), {
  ssr: false,
  loading: () => null,
});

/**
 * Decides whether to mount the WebGL canvas at all.
 * Hard fallbacks:
 *   - Low memory / low core devices → no WebGL, just the poster gradient.
 *   - Reduced motion → no WebGL.
 * Touch devices still get the orb but at dpr={1} via lowPower.
 */
export function HeroCanvas() {
  const [verdict, setVerdict] = useState<'pending' | 'render' | 'skip' | 'low'>(
    'pending'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setVerdict('skip');
      return;
    }
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
    const lowMem = (nav.deviceMemory ?? 4) < 4;
    const lowCpu = (nav.hardwareConcurrency ?? 4) < 4;
    if (lowMem || lowCpu) {
      setVerdict('skip');
      return;
    }
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    setVerdict(isTouch ? 'low' : 'render');
  }, []);

  if (verdict === 'pending' || verdict === 'skip') {
    return <div className="lv3-hero-poster" aria-hidden />;
  }
  return (
    <>
      <div className="lv3-hero-poster" aria-hidden />
      <div className="absolute inset-0">
        <OrbScene lowPower={verdict === 'low'} />
      </div>
    </>
  );
}
