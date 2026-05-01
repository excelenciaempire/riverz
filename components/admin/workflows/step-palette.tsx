'use client';

import {
  Sparkles,
  Repeat,
  GitBranch,
  Combine,
  Hourglass,
  StickyNote,
} from 'lucide-react';
import type { StepKind } from '@/lib/workflows/types';
import type { AvailableVariable } from '@/lib/workflows/collect-variables';

interface Props {
  onAdd: (kind: StepKind) => void;
  variables: AvailableVariable[];
}

const ITEMS: { kind: StepKind; label: string; Icon: any; color: string; hint: string }[] = [
  { kind: 'ai', label: 'Llamada a IA', Icon: Sparkles, color: 'text-purple-400', hint: 'Generar texto/imagen/video con un modelo' },
  { kind: 'loop', label: 'Loop (para cada)', Icon: Repeat, color: 'text-blue-400', hint: 'Iterar sobre una lista' },
  { kind: 'if', label: 'Condicional', Icon: GitBranch, color: 'text-amber-400', hint: 'Bifurcar el flujo según una condición' },
  { kind: 'merge', label: 'Merge', Icon: Combine, color: 'text-emerald-400', hint: 'Unir/combinar varios resultados' },
  { kind: 'wait', label: 'Esperar', Icon: Hourglass, color: 'text-cyan-400', hint: 'Polling, sleep o esperar evento' },
  { kind: 'note', label: 'Nota', Icon: StickyNote, color: 'text-gray-400', hint: 'Comentario libre, no ejecutable' },
];

export function StepPalette({ onAdd, variables }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Agregar paso
        </h3>
        <div className="space-y-1">
          {ITEMS.map(({ kind, label, Icon, color, hint }) => (
            <button
              key={kind}
              onClick={() => onAdd(kind)}
              title={hint}
              className="flex w-full items-center gap-2 rounded-md border border-gray-800 bg-[#141414] px-3 py-2 text-left text-sm text-white transition hover:border-gray-700 hover:bg-[#1a1a1a]"
            >
              <Icon size={14} className={color} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Variables disponibles
        </h3>
        {variables.length === 0 ? (
          <p className="text-xs italic text-gray-600">Define inputs o pasos primero.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-md border border-gray-800 bg-[#141414] p-2">
            {variables.map((v) => (
              <div key={v.ref} className="mb-2 last:mb-0">
                <code className="text-xs text-brand-accent">{v.ref}</code>
                <div className="text-[10px] text-gray-500">{v.type}</div>
                {v.description && (
                  <div className="text-[10px] text-gray-400">{v.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
