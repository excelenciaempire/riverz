'use client';

import { useRef, type ReactNode } from 'react';
import { useGsapScene, type SceneBuilder } from './useGsapScene';

export interface ScrollSceneProps {
  id?: string;
  /** Outer scroll length in vh — controls how long the section stays pinned. */
  pinDuration?: number;
  /** Mobile override; defaults to ~60% of pinDuration. */
  pinDurationMobile?: number;
  /** GSAP scrub smoothing (false = play once on enter, number = lerped scrub). */
  scrub?: number | boolean;
  /** Additional className for the outer wrapper (alters background, etc.). */
  className?: string;
  /** Additional className for the sticky stage. */
  stageClassName?: string;
  /** Receives ({ timeline, select }) so the caller can author scroll beats. */
  buildTimeline: SceneBuilder;
  children: ReactNode;
}

export function ScrollScene({
  id,
  pinDuration = 200,
  pinDurationMobile,
  scrub = 0.6,
  className = '',
  stageClassName = '',
  buildTimeline,
  children,
}: ScrollSceneProps) {
  const sceneRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useGsapScene(sceneRef, stageRef, buildTimeline, scrub);

  const desktopVh = pinDuration;
  const mobileVh = pinDurationMobile ?? Math.round(pinDuration * 0.65);

  return (
    <section
      id={id}
      ref={sceneRef}
      className={`lv3-scene ${className}`}
      style={
        {
          ['--lv3-scene-vh' as string]: `${desktopVh}vh`,
          ['--lv3-scene-vh-mobile' as string]: `${mobileVh}vh`,
          height: `clamp(${mobileVh}vh, ${desktopVh}vh, ${desktopVh}vh)`,
        } as React.CSSProperties
      }
    >
      <div ref={stageRef} className={`lv3-stage ${stageClassName}`}>
        {children}
      </div>
    </section>
  );
}
