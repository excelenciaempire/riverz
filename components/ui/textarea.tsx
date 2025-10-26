import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-3',
          'text-sm text-white placeholder:text-gray-600',
          'focus:outline-none focus:ring-1 focus:ring-brand-accent focus:border-brand-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };

