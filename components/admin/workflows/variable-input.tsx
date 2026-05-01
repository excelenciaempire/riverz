'use client';

import { useEffect, useRef, useState } from 'react';
import type { AvailableVariable } from '@/lib/workflows/collect-variables';

interface Props {
  value: string;
  onChange: (v: string) => void;
  variables: AvailableVariable[];
  placeholder?: string;
  rows?: number;
  monospace?: boolean;
  className?: string;
}

/**
 * Textarea that pops a dropdown when the user types `{{`. Pick a variable
 * to insert its full ref at the cursor.
 */
export function VariableInput({
  value,
  onChange,
  variables,
  placeholder,
  rows = 3,
  monospace,
  className,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [filter, setFilter] = useState('');
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!showPicker) setHighlight(0);
  }, [showPicker, filter]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    const cursor = e.target.selectionStart;
    const before = next.slice(0, cursor);
    const m = before.match(/\{\{([^}\s]*)$/);
    if (m) {
      setFilter(m[1]);
      setShowPicker(true);
      const rect = e.target.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    } else {
      setShowPicker(false);
    }
  }

  function insert(v: AvailableVariable) {
    const ta = ref.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = value.slice(0, cursor).replace(/\{\{[^}\s]*$/, '');
    const after = value.slice(cursor);
    const next = before + v.ref + after;
    onChange(next);
    setShowPicker(false);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = before.length + v.ref.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showPicker) return;
    const filtered = filteredVars();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered[highlight]) {
        e.preventDefault();
        insert(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      setShowPicker(false);
    }
  }

  function filteredVars() {
    if (!filter) return variables;
    return variables.filter((v) =>
      v.ref.toLowerCase().includes(filter.toLowerCase()),
    );
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowPicker(false), 150)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full resize-y rounded-md border border-gray-800 bg-[#0d0d0d] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-brand-accent focus:outline-none ${
          monospace ? 'font-mono' : ''
        } ${className || ''}`}
      />
      {showPicker && pickerPos && (
        <div
          className="fixed z-50 max-h-72 w-96 overflow-y-auto rounded-md border border-gray-700 bg-[#1a1a1a] shadow-xl"
          style={{ top: pickerPos.top, left: pickerPos.left }}
        >
          {filteredVars().length === 0 ? (
            <div className="p-3 text-sm text-gray-500">Sin variables disponibles</div>
          ) : (
            filteredVars().map((v, i) => (
              <button
                key={v.ref}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(v);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === highlight ? 'bg-gray-800' : ''
                } hover:bg-gray-800`}
              >
                <div className="flex items-center justify-between">
                  <code className="text-brand-accent">{v.ref}</code>
                  <span className="text-xs text-gray-500">{v.type}</span>
                </div>
                {v.description && (
                  <div className="mt-0.5 truncate text-xs text-gray-500">{v.description}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
