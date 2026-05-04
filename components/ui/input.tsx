import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Editorial input. Picks up theme tokens automatically — surface goes
 * cream in light mode and inky in dark mode without any caller change.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border bg-[var(--rvz-input-bg)] border-[var(--rvz-input-border)] px-3.5 py-2',
          'text-[14px] text-[var(--rvz-ink)] placeholder:text-[var(--rvz-ink-faint)]',
          'focus:outline-none focus:border-[var(--rvz-ink)] focus:ring-2 focus:ring-[var(--rvz-focus-ring)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
