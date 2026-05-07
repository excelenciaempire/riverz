'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export type SceneBuilder = (
  ctx: gsap.Context,
  helpers: {
    timeline: gsap.core.Timeline;
    matchMedia: gsap.MatchMedia;
    select: <T extends Element = HTMLElement>(selector: string) => T[];
  }
) => void;

/**
 * Mounts a scrubbed GSAP timeline tied to the outer scene's scroll progress.
 * The inner stage is sticky (CSS), so we don't ask ScrollTrigger to pin DOM —
 * we only use it as a scrub driver. This avoids the App Router + React 19
 * concurrent-render layout drift issues that pin:true introduces.
 */
export function useGsapScene(
  sceneRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  build: SceneBuilder,
  scrub: number | boolean = 0.6
) {
  const builtRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sceneEl = sceneRef.current;
    const stageEl = stageRef.current;
    if (!sceneEl || !stageEl || builtRef.current) return;
    builtRef.current = true;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: reducedMotion
          ? undefined
          : {
              trigger: sceneEl,
              start: 'top top',
              end: 'bottom bottom',
              scrub,
              invalidateOnRefresh: true,
            },
      });

      const select = <T extends Element = HTMLElement>(selector: string): T[] =>
        Array.from(stageEl.querySelectorAll<T>(selector));

      build(ctx, { timeline: tl, matchMedia: mm, select });
      stageEl.setAttribute('data-lv3-ready', 'true');
    }, stageEl);

    return () => {
      ctx.revert();
      builtRef.current = false;
    };
  }, [sceneRef, stageRef, build, scrub]);
}
