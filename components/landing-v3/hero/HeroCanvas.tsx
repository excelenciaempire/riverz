'use client';

import { Component, type ReactNode, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const OrbScene = dynamic(() => import('./OrbScene').then((m) => m.OrbScene), {
  ssr: false,
  loading: () => null,
});

class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[HeroCanvas] WebGL boundary caught:', err);
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * Decides whether to mount the WebGL canvas at all.
 *   - Reduced motion → poster only.
 *   - Low memory / low core devices → poster only.
 *   - Touch devices → canvas at dpr=1 (lowPower).
 *   - Desktop → full-quality canvas.
 * In every case, the poster gradient is rendered first so LCP doesn't wait
 * on WebGL hydration. If the canvas fails for any reason, the boundary
 * keeps the poster visible and the rest of the page continues to work.
 */
export function HeroCanvas() {
  const [verdict, setVerdict] = useState<'pending' | 'render' | 'skip' | 'low'>(
    'pending'
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
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
      // WebGL feature detection — some incognito sessions / bots return null.
      const probe = document.createElement('canvas');
      const gl = (probe.getContext('webgl2') ||
        probe.getContext('webgl')) as WebGLRenderingContext | null;
      if (!gl) {
        setVerdict('skip');
        return;
      }
      const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      setVerdict(isTouch ? 'low' : 'render');
    } catch {
      setVerdict('skip');
    }
  }, []);

  const poster = <div className="lv3-hero-poster" aria-hidden />;

  if (verdict === 'pending' || verdict === 'skip') {
    return poster;
  }
  return (
    <>
      {poster}
      <div className="absolute inset-0">
        <CanvasErrorBoundary fallback={null}>
          <OrbScene lowPower={verdict === 'low'} />
        </CanvasErrorBoundary>
      </div>
    </>
  );
}
