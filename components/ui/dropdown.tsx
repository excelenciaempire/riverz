'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  openDirection?: 'up' | 'down';
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Selecciona una opción',
  className,
  openDirection = 'down',
}: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-700',
          'bg-brand-dark-secondary px-3 py-2 text-sm text-white',
          'focus:outline-none focus:border-brand-accent',
          className
        )}
      >
        <span className={cn('truncate', !selectedOption ? 'text-gray-500' : '')}>
          {selectedOption?.label || placeholder}
        </span>
        {openDirection === 'up' ? (
          <ChevronUp className={cn('h-4 w-4 flex-shrink-0 ml-2 transition-transform', isOpen && 'rotate-180')} />
        ) : (
          <ChevronDown className={cn('h-4 w-4 flex-shrink-0 ml-2 transition-transform', isOpen && 'rotate-180')} />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsOpen(false)}
          />
          <div 
            className={cn(
              'absolute z-[101] w-full rounded-md border border-gray-700 bg-[#1a1a1a] shadow-xl',
              openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
            )}
          >
            <div className="max-h-60 overflow-auto py-1">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No hay opciones</div>
              ) : (
                options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-gray-700 truncate',
                      option.value === value
                        ? 'bg-brand-accent text-white'
                        : 'text-white'
                    )}
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

