'use client';

import { Plus, X } from 'lucide-react';
import type { VariableDecl, VariableType } from '@/lib/workflows/types';

const TYPES: VariableType[] = ['text', 'number', 'image_url', 'video_url', 'json', 'list'];

interface Props {
  inputs: VariableDecl[];
  onChange: (next: VariableDecl[]) => void;
}

export function InputsEditor({ inputs, onChange }: Props) {
  function update(i: number, patch: Partial<VariableDecl>) {
    onChange(inputs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function add() {
    onChange([...inputs, { name: '', type: 'text', description: '' }]);
  }
  function remove(i: number) {
    onChange(inputs.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-[#141414] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Inputs del workflow</h3>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs text-brand-accent hover:opacity-80"
        >
          <Plus size={12} /> Agregar input
        </button>
      </div>
      {inputs.length === 0 ? (
        <p className="text-xs italic text-gray-600">
          Variables que el usuario o sistema debe proveer al iniciar este workflow.
        </p>
      ) : (
        <div className="space-y-2">
          {inputs.map((v, i) => (
            <div key={i} className="rounded-md border border-gray-800 bg-[#0d0d0d] p-2">
              <div className="flex items-center gap-2">
                <input
                  value={v.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="nombre"
                  className="flex-1 rounded border border-gray-800 bg-[#1a1a1a] px-2 py-1 font-mono text-xs text-white focus:border-brand-accent focus:outline-none"
                />
                <select
                  value={v.type}
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
                value={v.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="descripción"
                className="mt-2 w-full rounded border border-gray-800 bg-[#1a1a1a] px-2 py-1 text-xs text-gray-300 focus:border-brand-accent focus:outline-none"
              />
              <input
                value={v.example || ''}
                onChange={(e) => update(i, { example: e.target.value })}
                placeholder="ejemplo (opcional)"
                className="mt-2 w-full rounded border border-gray-800 bg-[#1a1a1a] px-2 py-1 text-xs text-gray-400 focus:border-brand-accent focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
