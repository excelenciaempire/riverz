'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Repeat,
  GitBranch,
  Combine,
  Hourglass,
  StickyNote,
} from 'lucide-react';
import type {
  Step,
  AIStep,
  LoopStep,
  ConditionalStep,
  MergeStep,
  WaitStep,
  NoteStep,
  AIProvider,
} from '@/lib/workflows/types';
import type { AvailableVariable } from '@/lib/workflows/collect-variables';
import { VariableInput } from './variable-input';
import { OutputsEditor } from './outputs-editor';
import { StepList } from './step-list';

const KIND_META: Record<Step['kind'], { label: string; color: string; Icon: any }> = {
  ai: { label: 'IA', color: 'text-purple-400', Icon: Sparkles },
  loop: { label: 'Loop', color: 'text-blue-400', Icon: Repeat },
  if: { label: 'Condicional', color: 'text-amber-400', Icon: GitBranch },
  merge: { label: 'Merge', color: 'text-emerald-400', Icon: Combine },
  wait: { label: 'Esperar', color: 'text-cyan-400', Icon: Hourglass },
  note: { label: 'Nota', color: 'text-gray-400', Icon: StickyNote },
};

const PROVIDERS: AIProvider[] = ['kie', 'gemini', 'nano-banana', 'veo-3', 'openai', 'anthropic', 'other'];

interface Props {
  step: Step;
  number: string;
  variables: AvailableVariable[];
  hasError: boolean;
  onChange: (next: Step) => void;
  onRemove: () => void;
  collectVarsAt: (stepId: string) => AvailableVariable[];
}

export function StepCard({ step, number, variables, hasError, onChange, onRemove, collectVarsAt }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = KIND_META[step.kind];
  const Icon = meta.Icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-[#141414] ${
        hasError ? 'border-red-700' : 'border-gray-800'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-600 hover:text-gray-300 active:cursor-grabbing"
          title="Arrastrar"
        >
          <GripVertical size={16} />
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-white"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <span className="font-mono text-xs text-gray-500">{number}</span>
        <Icon size={14} className={meta.color} />
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="flex-1 truncate text-sm text-white">
          {step.kind === 'note' ? (step as NoteStep).text.slice(0, 60) || 'Nota vacía' : (step as any).name}
        </span>
        {hasError && (
          <span className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
            refs rotas
          </span>
        )}
        <button
          onClick={onRemove}
          className="rounded p-1 text-gray-500 hover:bg-red-900/40 hover:text-red-400"
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-900 px-3 py-3">
          {step.kind === 'ai' && (
            <AICardBody step={step} variables={variables} onChange={(s) => onChange(s)} />
          )}
          {step.kind === 'loop' && (
            <LoopCardBody
              step={step}
              variables={variables}
              onChange={(s) => onChange(s)}
              collectVarsAt={collectVarsAt}
            />
          )}
          {step.kind === 'if' && (
            <IfCardBody
              step={step}
              variables={variables}
              onChange={(s) => onChange(s)}
              collectVarsAt={collectVarsAt}
            />
          )}
          {step.kind === 'merge' && (
            <MergeCardBody step={step} variables={variables} onChange={(s) => onChange(s)} />
          )}
          {step.kind === 'wait' && (
            <WaitCardBody step={step} variables={variables} onChange={(s) => onChange(s)} />
          )}
          {step.kind === 'note' && <NoteCardBody step={step} onChange={(s) => onChange(s)} />}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function plainInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-gray-800 bg-[#0d0d0d] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-brand-accent focus:outline-none ${props.className || ''}`}
    />
  );
}

function plainTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full resize-y rounded-md border border-gray-800 bg-[#0d0d0d] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-brand-accent focus:outline-none ${props.className || ''}`}
    />
  );
}

function AICardBody({
  step,
  variables,
  onChange,
}: {
  step: AIStep;
  variables: AvailableVariable[];
  onChange: (s: AIStep) => void;
}) {
  return (
    <>
      <Field label="Nombre del paso">
        {plainInput({
          value: step.name,
          onChange: (e) => onChange({ ...step, name: e.target.value }),
          placeholder: 'Generar escenas',
        })}
      </Field>
      <Field label="Descripción (qué pasa aquí)">
        {plainTextarea({
          value: step.description,
          onChange: (e) => onChange({ ...step, description: e.target.value }),
          rows: 2,
          placeholder: 'Crea N imágenes describiendo cada escena del video',
        })}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Provider">
          <select
            value={step.provider}
            onChange={(e) => onChange({ ...step, provider: e.target.value as AIProvider })}
            className="w-full rounded-md border border-gray-800 bg-[#0d0d0d] px-3 py-2 text-sm text-white focus:border-brand-accent focus:outline-none"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Modelo (opcional)">
          {plainInput({
            value: step.model || '',
            onChange: (e) => onChange({ ...step, model: e.target.value }),
            placeholder: 'gemini-3-pro, nano-banana-pro, veo-3-fast…',
          })}
        </Field>
      </div>
      <Field label="Prompt (usa {{var}} para referenciar variables)">
        <VariableInput
          value={step.promptTemplate}
          onChange={(v) => onChange({ ...step, promptTemplate: v })}
          variables={variables}
          rows={6}
          monospace
          placeholder="A partir de {{inputs.concepto}}, genera…"
        />
      </Field>
      <OutputsEditor
        outputs={step.outputs}
        onChange={(outs) => onChange({ ...step, outputs: outs })}
      />
      <div className="mt-3">
        <Field label="Notas para Claude (opcional)">
          <VariableInput
            value={step.notes || ''}
            onChange={(v) => onChange({ ...step, notes: v })}
            variables={variables}
            rows={2}
            placeholder="Detalles, restricciones, ejemplos…"
          />
        </Field>
      </div>
    </>
  );
}

function LoopCardBody({
  step,
  variables,
  onChange,
  collectVarsAt,
}: {
  step: LoopStep;
  variables: AvailableVariable[];
  onChange: (s: LoopStep) => void;
  collectVarsAt: (stepId: string) => AvailableVariable[];
}) {
  return (
    <>
      <Field label="Nombre del paso">
        {plainInput({
          value: step.name,
          onChange: (e) => onChange({ ...step, name: e.target.value }),
          placeholder: 'Para cada escena',
        })}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Iterar sobre (lista)">
          <VariableInput
            value={step.iterateOver}
            onChange={(v) => onChange({ ...step, iterateOver: v })}
            variables={variables}
            rows={1}
            monospace
            placeholder="{{step_1.escenas}}"
          />
        </Field>
        <Field label="Alias por iteración">
          {plainInput({
            value: step.itemAlias,
            onChange: (e) => onChange({ ...step, itemAlias: e.target.value }),
            placeholder: 'escena',
          })}
        </Field>
      </div>
      <div className="mb-3 rounded-md border border-blue-900/40 bg-blue-950/20 p-3">
        <p className="mb-2 text-xs text-blue-300">
          Pasos anidados (se ejecutan por cada <code className="text-blue-200">{`{{${step.itemAlias}}}`}</code>)
        </p>
        <StepList
          steps={step.steps}
          numberPrefix=""
          onChange={(steps) => onChange({ ...step, steps })}
          collectVarsAt={collectVarsAt}
          parentNumber=""
          containerId={step.id}
        />
      </div>
      <OutputsEditor
        outputs={step.outputs}
        onChange={(outs) => onChange({ ...step, outputs: outs })}
        label="Outputs del loop (típicamente la lista resultante)"
      />
    </>
  );
}

function IfCardBody({
  step,
  variables,
  onChange,
  collectVarsAt,
}: {
  step: ConditionalStep;
  variables: AvailableVariable[];
  onChange: (s: ConditionalStep) => void;
  collectVarsAt: (stepId: string) => AvailableVariable[];
}) {
  return (
    <>
      <Field label="Nombre">
        {plainInput({
          value: step.name,
          onChange: (e) => onChange({ ...step, name: e.target.value }),
        })}
      </Field>
      <Field label="Condición">
        <VariableInput
          value={step.condition}
          onChange={(v) => onChange({ ...step, condition: v })}
          variables={variables}
          rows={2}
          monospace
          placeholder="{{step_2.score}} > 0.7"
        />
      </Field>
      <div className="mb-3 rounded-md border border-amber-900/40 bg-amber-950/10 p-3">
        <p className="mb-2 text-xs text-amber-300">Entonces:</p>
        <StepList
          steps={step.thenSteps}
          numberPrefix=""
          onChange={(steps) => onChange({ ...step, thenSteps: steps })}
          collectVarsAt={collectVarsAt}
          parentNumber=""
          containerId={`${step.id}-then`}
        />
      </div>
      <div className="rounded-md border border-gray-800 bg-[#0d0d0d] p-3">
        <p className="mb-2 text-xs text-gray-400">Sino:</p>
        <StepList
          steps={step.elseSteps}
          numberPrefix=""
          onChange={(steps) => onChange({ ...step, elseSteps: steps })}
          collectVarsAt={collectVarsAt}
          parentNumber=""
          containerId={`${step.id}-else`}
        />
      </div>
    </>
  );
}

function MergeCardBody({
  step,
  variables,
  onChange,
}: {
  step: MergeStep;
  variables: AvailableVariable[];
  onChange: (s: MergeStep) => void;
}) {
  return (
    <>
      <Field label="Nombre">
        {plainInput({
          value: step.name,
          onChange: (e) => onChange({ ...step, name: e.target.value }),
          placeholder: 'Unir clips en video final',
        })}
      </Field>
      <Field label="Descripción">
        {plainTextarea({
          value: step.description,
          onChange: (e) => onChange({ ...step, description: e.target.value }),
          rows: 2,
        })}
      </Field>
      <Field label="Inputs a unir (uno por línea)">
        <VariableInput
          value={step.inputs.join('\n')}
          onChange={(v) =>
            onChange({ ...step, inputs: v.split('\n').map((x) => x.trim()).filter(Boolean) })
          }
          variables={variables}
          rows={3}
          monospace
          placeholder="{{step_2.clips}}"
        />
      </Field>
      <OutputsEditor
        outputs={step.outputs}
        onChange={(outs) => onChange({ ...step, outputs: outs })}
      />
    </>
  );
}

function WaitCardBody({
  step,
  variables,
  onChange,
}: {
  step: WaitStep;
  variables: AvailableVariable[];
  onChange: (s: WaitStep) => void;
}) {
  return (
    <>
      <Field label="Nombre">
        {plainInput({
          value: step.name,
          onChange: (e) => onChange({ ...step, name: e.target.value }),
        })}
      </Field>
      <Field label="Descripción">
        {plainTextarea({
          value: step.description,
          onChange: (e) => onChange({ ...step, description: e.target.value }),
          rows: 2,
        })}
      </Field>
      <Field label="Esperar hasta que (en lenguaje natural)">
        <VariableInput
          value={step.pollUntil || ''}
          onChange={(v) => onChange({ ...step, pollUntil: v })}
          variables={variables}
          rows={2}
          placeholder="todos los {{step_2.clips}} estén listos"
        />
      </Field>
    </>
  );
}

function NoteCardBody({ step, onChange }: { step: NoteStep; onChange: (s: NoteStep) => void }) {
  return (
    <Field label="Nota (markdown)">
      {plainTextarea({
        value: step.text,
        onChange: (e) => onChange({ ...step, text: e.target.value }),
        rows: 4,
        placeholder: 'Recordatorios, contexto, decisiones tomadas…',
      })}
    </Field>
  );
}
