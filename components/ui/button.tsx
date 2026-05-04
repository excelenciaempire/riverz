import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'dark';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * App-wide button. Default uses Riverz's editorial yellow accent on
 * top of any background; variants pick up the active theme via the
 * --rvz-* tokens so the same Button reads correctly in both light
 * and dark mode.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--rvz-focus-ring)]',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-[var(--rvz-accent)] text-[var(--rvz-accent-fg)] hover:bg-[var(--rvz-accent-hover)] uppercase tracking-[0.04em] text-[12px] font-bold':
              variant === 'default',
            'border border-[var(--rvz-card-border)] text-[var(--rvz-ink)] hover:border-[var(--rvz-card-hover-border)] hover:bg-[var(--rvz-bg-soft)] uppercase tracking-[0.04em] text-[12px] font-semibold':
              variant === 'outline',
            'hover:bg-[var(--rvz-bg-soft)] text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]':
              variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
            'bg-[var(--rvz-ink)] text-[var(--rvz-accent)] hover:opacity-90 uppercase tracking-[0.04em] text-[12px] font-bold':
              variant === 'dark',
            'h-10 px-4 py-2': size === 'default',
            'h-9 px-3 text-[11px]': size === 'sm',
            'h-12 px-7': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
