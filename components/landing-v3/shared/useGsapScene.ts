'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export type SceneBuilder = (helpers: {
  timeline: gsap.core.Timeline;
  matchMedia: gsap.MatchMedia;
  select: <T extends Element = HTMLElement>(selector: string) => T[];
}) => void;

/**
 * Mounts a scrubbed GSAP timeline tied to the outer scene's scroll progress.
 * The inner stage is sticky (CSS), so we don't ask ScrollTrigger to pin DOM —
 * we only use it as a scrub driver. This avoids the App Router + React 19
 * concurrent-render layout drift issues that pin:true introduces.
 *
 * The scene builder receives only the helpers it needs (timeline, matchMedia,
 * select). Earlier versions also passed `gsap.Context` itself, but that
 * created a TDZ — the callback executes synchronously inside `gsap.context()`,
 * so referencing the outer `const ctx = ...` inside it crashes with
 * "Cannot access 'ctx' before initialization".
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

    // Register the plugin lazily — putting registerPlugin at module scope
    // can produce a TDZ in some minified production bundles.
    gsap.registerPlugin(ScrollTrigger);

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

      build({ timeline: tl, matchMedia: mm, select });
      stageEl.setAttribute('data-lv3-ready', 'true');
    }, stageEl);

    return () => {
      ctx.revert();
      builtRef.current = false;
    };
  }, [sceneRef, stageRef, build, scrub]);
}
