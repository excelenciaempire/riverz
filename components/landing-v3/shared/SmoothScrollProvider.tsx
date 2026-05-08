'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Plugin registration is idempotent — safe to call here on every mount.
    // Module-scope registration would put us in TDZ territory under SWC mangle.
    gsap.registerPlugin(ScrollTrigger);

    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isTouch || reducedMotion) {
      ScrollTrigger.refresh();
      return;
    }

    const lenis = new Lenis({
      duration: 0.8,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1,
    });

    // Critical for fluidity: drive Lenis from GSAP's ticker so Lenis,
    // ScrollTrigger and every tween share a single RAF loop. Running
    // our own requestAnimationFrame in parallel produces frame mismatches
    // that read as "not smooth" even though no frames are actually dropped.
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    lenis.on('scroll', ScrollTrigger.update);
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
