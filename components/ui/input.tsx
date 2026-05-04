import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Editorial input. Cream surface inside a white card by default, with
 * an ink border on focus instead of teal. Pages still on the legacy
 * dark theme can pass their own dark classes via `className`.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border border-[#e3e0d5] bg-white px-3.5 py-2',
          'text-[14px] text-black placeholder:text-black/35',
          'focus:outline-none focus:border-black focus:ring-2 focus:ring-black/[0.08]',
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
