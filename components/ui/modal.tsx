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
          'relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#141414] p-8',
          'border border-gray-800 shadow-2xl',
          className
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1 text-gray-400 transition hover:bg-gray-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        {title && (
          <h2 className="mb-6 text-2xl font-semibold text-white pr-10">{title}</h2>
        )}

        {/* Content */}
        <div className="text-white">{children}</div>
      </div>
    </div>
  );
}

