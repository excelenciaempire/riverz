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

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-lg bg-brand-dark-secondary p-6',
          'border border-gray-700 shadow-xl',
          className
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm text-gray-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        {title && (
          <h2 className="mb-4 text-xl font-semibold text-white">{title}</h2>
        )}

        {/* Content */}
        <div className="text-white">{children}</div>
      </div>
    </div>
  );
}

