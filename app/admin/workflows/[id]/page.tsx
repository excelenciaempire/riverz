'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { isAdminEmail } from '@/lib/admin-emails';
import { ArrowLeft, Save, Check } from 'lucide-react';
import {
  EMPTY_WORKFLOW,
  newStep,
  type Step,
  type StepKind,
  type WorkflowDesign,
  type VariableDecl,
} from '@/lib/workflows/types';
import { collectAvailableVariables } from '@/lib/workflows/collect-variables';
import { validateWorkflow } from '@/lib/workflows/validate';
import { StepPalette } from '@/components/admin/workflows/step-palette';
import { StepList } from '@/components/admin/workflows/step-list';
import { WorkflowPreview } from '@/components/admin/workflows/workflow-preview';
import { InputsEditor } from '@/components/admin/workflows/inputs-editor';
import { WorkflowProvider } from '@/components/admin/workflows/workflow-context';

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  definition: WorkflowDesign;
  created_at: string;
  updated_at: string;
}

export default function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workflow, setWorkflow] = useState<WorkflowDesign>(EMPTY_WORKFLOW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (isLoaded) {
      if (!user) router.push('/admin');
      else {
        const email = user.emailAddresses[0]?.emailAddress || '';
        if (!isAdminEmail(email)) router.push('/admin/unauthorized');
      }
    }
  }, [user, isLoaded, router]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/admin/workflows/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data: WorkflowRow) => {
        setName(data.name);
        setDescription(data.description || '');
        setWorkflow({
          inputs: data.definition?.inputs || [],
          steps: data.definition?.steps || [],
          outputs: data.definition?.outputs || [],
        });
        setLoading(false);
      })
      .catch(() => {
        alert('Workflow no encontrado');
        router.push('/admin/workflows');
      });
  }, [id, user, router]);

  // Mark dirty whenever the user edits anything (post-load).
  useEffect(() => {
    if (!loading) dirtyRef.current = true;
  }, [name, description, workflow, loading]);

  // Auto-save with debounce.
  useEffect(() => {
    if (loading) return;
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      save();
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, workflow, loading]);

  async function save() {
    setSaving(true);
    const r = await fetch(`/api/admin/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || 'Workflow sin nombre',
        description: description || null,
        definition: workflow,
      }),
    });
    setSaving(false);
    if (!r.ok) {
      alert('Error guardando');
      return;
    }
    dirtyRef.current = false;
    setSavedAt(Date.now());
  }

  const issues = useMemo(() => validateWorkflow(workflow), [workflow]);
  const issuesByStep = useMemo(() => {
    const m = new Map<string, ReturnType<typeof validateWorkflow>>();
    for (const i of issues) {
      if (!i.stepId) continue;
      const arr = m.get(i.stepId) || [];
      arr.push(i);
      m.set(i.stepId, arr);
    }
    return m;
  }, [issues]);

  const collectVarsAt = useMemo(
    () => (stepId: string) => collectAvailableVariables(workflow, stepId),
    [workflow],
  );

  const allVariables = useMemo(
    () => collectAvailableVariables(workflow, null),
    [workflow],
  );

  function addStepAtRoot(kind: StepKind) {
    setWorkflow((w) => ({ ...w, steps: [...w.steps, newStep(kind)] }));
  }

  function setSteps(steps: Step[]) {
    setWorkflow((w) => ({ ...w, steps }));
  }

  function setInputs(inputs: VariableDecl[]) {
    setWorkflow((w) => ({ ...w, inputs }));
  }

  function setOutputs(outputs: string[]) {
    setWorkflow((w) => ({ ...w, outputs }));
  }

  if (!isLoaded || !user || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-gray-400">
        Cargando…
      </div>
    );
  }

  return (
    <WorkflowProvider issuesByStep={issuesByStep}>
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="border-b border-gray-900 bg-black px-6 py-4">
          <div className="mx-auto flex max-w-[1800px] items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/workflows"
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
              >
                <ArrowLeft size={14} /> Workflows
              </Link>
              <div className="h-5 w-px bg-gray-700" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-none bg-transparent text-lg font-semibold text-white focus:outline-none"
                placeholder="Nombre del workflow"
              />
            </div>
            <div className="flex items-center gap-3 text-xs">
              {issues.length > 0 && (
                <span className="rounded bg-red-900/40 px-2 py-1 text-red-300">
                  {issues.length} ref{issues.length === 1 ? '' : 's'} rota{issues.length === 1 ? '' : 's'}
                </span>
              )}
              {saving ? (
                <span className="text-gray-500">Guardando…</span>
              ) : savedAt ? (
                <span className="flex items-center gap-1 text-gray-500">
                  <Check size={12} /> Guardado
                </span>
              ) : null}
              <button
                onClick={save}
                className="flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"
              >
                <Save size={12} /> Guardar
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-[1800px] grid-cols-12 gap-4 px-6 py-6">
          <aside className="col-span-2">
            <div className="sticky top-4">
              <StepPalette onAdd={addStepAtRoot} variables={allVariables} />
            </div>
          </aside>

          <main className="col-span-6 space-y-4">
            <div className="rounded-lg border border-gray-800 bg-[#141414] p-4">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Qué hace este workflow y para qué sirve"
                className="w-full resize-y rounded-md border border-gray-800 bg-[#0d0d0d] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-brand-accent focus:outline-none"
              />
            </div>

            <InputsEditor inputs={workflow.inputs} onChange={setInputs} />

            <div className="rounded-lg border border-gray-800 bg-[#141414] p-4">
              <h3 className="mb-3 text-sm font-semibold text-white">Pasos</h3>
              <StepList
                steps={workflow.steps}
                numberPrefix=""
                parentNumber=""
                onChange={setSteps}
                collectVarsAt={collectVarsAt}
                containerId="root"
              />
            </div>

            <div className="rounded-lg border border-gray-800 bg-[#141414] p-4">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Outputs del workflow (uno por línea, ej: <code>{`{{step_3.video_final}}`}</code>)
              </label>
              <textarea
                value={workflow.outputs.join('\n')}
                onChange={(e) =>
                  setOutputs(
                    e.target.value
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
                rows={3}
                className="w-full resize-y rounded-md border border-gray-800 bg-[#0d0d0d] px-3 py-2 font-mono text-sm text-white placeholder:text-gray-600 focus:border-brand-accent focus:outline-none"
                placeholder="{{step_3.video_final}}"
              />
            </div>
          </main>

          <aside className="col-span-4">
            <div className="sticky top-4 h-[calc(100vh-2rem)]">
              <WorkflowPreview meta={{ name, description: description || null }} workflow={workflow} />
            </div>
          </aside>
        </div>
      </div>
    </WorkflowProvider>
  );
}
