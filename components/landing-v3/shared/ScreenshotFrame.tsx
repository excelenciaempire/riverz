import type { ReactNode } from 'react';

interface ScreenshotFrameProps {
  /** Aspect ratio in W/H (e.g. "16/10"). Defaults to 16/10. */
  aspect?: string;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}

/**
 * Editorial frame for art-directed screenshots and faux-app mockups.
 * Provides the consistent rounded ring + soft shadow used across the v3 landing.
 */
export function ScreenshotFrame({
  aspect = '16/10',
  className = '',
  innerClassName = '',
  children,
}: ScreenshotFrameProps) {
  return (
    <div
      className={`lv3-frame ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <div className={`relative h-full w-full ${innerClassName}`}>{children}</div>
    </div>
  );
}
