import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border bg-[var(--rvz-input-bg)] border-[var(--rvz-input-border)] px-3.5 py-3',
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
Textarea.displayName = 'Textarea';

export { Textarea };
