'use client';

import { Plus, X } from 'lucide-react';
import type { VariableDecl, VariableType } from '@/lib/workflows/types';

const TYPES: VariableType[] = ['text', 'number', 'image_url', 'video_url', 'json', 'list'];

interface Props {
  outputs: VariableDecl[];
  onChange: (next: VariableDecl[]) => void;
  label?: string;
}

export function OutputsEditor({ outputs, onChange, label = 'Outputs' }: Props) {
  function update(i: number, patch: Partial<VariableDecl>) {
    const next = outputs.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onChange(next);
  }
  function add() {
    onChange([...outputs, { name: '', type: 'text', description: '' }]);
  }
  function remove(i: number) {
    onChange(outputs.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </label>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs text-brand-accent hover:opacity-80"
        >
          <Plus size={12} /> Agregar
        </button>
      </div>
      {outputs.length === 0 ? (
        <p className="text-xs italic text-gray-600">Sin outputs declarados</p>
      ) : (
        <div className="space-y-2">
          {outputs.map((o, i) => (
            <div key={i} className="rounded-md border border-gray-800 bg-[#0d0d0d] p-2">
              <div className="flex items-center gap-2">
                <input
                  value={o.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="nombre"
                  className="flex-1 rounded border border-gray-800 bg-[#1a1a1a] px-2 py-1 font-mono text-xs text-white focus:border-brand-accent focus:outline-none"
                />
                <select
                  value={o.type}
                  onChange={(e) => update(i, { type: e.target.value as VariableType })}
                  className="rounded border border-gray-800 bg-[#1a1a1a] px-2 py-1 text-xs text-white focus:border-brand-accent focus:outline-none"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded p-1 text-gray-500 hover:bg-red-900/40 hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                value={o.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="descripción (qué representa)"
                className="mt-2 w-full rounded border border-gray-800 bg-[#1a1a1a] px-2 py-1 text-xs text-gray-300 focus:border-brand-accent focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
