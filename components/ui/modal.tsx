'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Editorial modal — theme-aware via the --rvz-* tokens. Surface and
 * border swap automatically when the user flips Configuración →
 * Apariencia.
 */
export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          'relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-7 md:p-8',
          'bg-[var(--rvz-card)] border border-[var(--rvz-card-border)] text-[var(--rvz-ink)] shadow-2xl',
          className,
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md text-[var(--rvz-ink-muted)] transition hover:bg-[var(--rvz-bg-soft)] hover:text-[var(--rvz-ink)]"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        {title && (
          <h2
            className="mb-6 pr-10 text-[26px] font-medium tracking-tight"
            style={{ letterSpacing: '-0.025em' }}
          >
            {title}
          </h2>
        )}

        <div>{children}</div>
      </div>
    </div>
  );
}
