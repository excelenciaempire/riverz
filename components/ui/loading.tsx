'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  text?: string;
  className?: string;
}

export function Loading({ text = 'Cargando...', className }: LoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-8', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
      {text && <p className="text-sm text-gray-400">{text}</p>}
    </div>
  );
}

export function ProgressBar({ progress, text }: { progress: number; text?: string }) {
  return (
    <div className="w-full space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
        <div
          className="h-full bg-brand-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {text && <p className="text-center text-sm text-gray-400">{text}</p>}
    </div>
  );
}

