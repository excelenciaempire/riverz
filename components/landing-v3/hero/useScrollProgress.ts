'use client';

import { useEffect, useState } from 'react';

/**
 * Lightweight cross-component bridge for the hero scroll progress (0 → 1).
 * GSAP timeline writes to this store via setHeroProgress; the R3F canvas
 * reads it inside useFrame without re-rendering the React tree.
 *
 * Module-level singleton — survives strict-mode double mount in dev.
 */
type Listener = (v: number) => void;

let progress = 0;
const listeners = new Set<Listener>();

export function setHeroProgress(v: number) {
  progress = Math.min(1, Math.max(0, v));
  listeners.forEach((cb) => cb(progress));
}

export function getHeroProgress() {
  return progress;
}

/** React hook that subscribes a component to hero progress (re-renders). */
export function useHeroProgress(): number {
  const [value, setValue] = useState(progress);
  useEffect(() => {
    const cb: Listener = (v) => setValue(v);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return value;
}
