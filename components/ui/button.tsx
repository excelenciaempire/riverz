import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'dark';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * App-wide button. The default variant uses Riverz's editorial accent
 * (yellow #f7ff9e on black ink) so any caller that didn't pick a variant
 * inherits the new design language. Old variants remain intact for code
 * still on the dark theme.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black/30',
          'disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-[#f7ff9e] text-black hover:bg-[#f1fa84] uppercase tracking-[0.04em] text-[12px] font-bold':
              variant === 'default',
            'border border-black/15 text-black hover:border-black/40 hover:bg-black/[0.03] uppercase tracking-[0.04em] text-[12px] font-semibold':
              variant === 'outline',
            'hover:bg-black/[0.05] text-black/80': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
            'bg-[#0a0a0a] text-[#f7ff9e] hover:bg-[#1a1a22] uppercase tracking-[0.04em] text-[12px] font-bold':
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
