'use client';

/**
 * Editor V2 — root client component. Tiene tres regiones:
 *   - LeftRail (iconos: Add Section / Layers / History)
 *   - Panel activo (cambia según la herramienta seleccionada)
 *   - Canvas central que renderiza el documento de la página en vivo
 *
 * Toda la edición pasa por el reducer en `useEditorState`. Cada cambio
 * dispara autosave debounced contra `/api/landing-pages/{id}`.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Layers,
  History,
  Eye,
  Send,
  ArrowLeft,
  Sparkles,
  Save,
  Trash2,
  GripVertical,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type SectionCategory,
} from '@/lib/sections/types';
import { SECTIONS, getSection, getSectionsByCategory } from '@/lib/sections/registry';
import type { LandingPage, PageDocument, SectionInstance } from '@/types/landing-pages';

type Tool = 'add' | 'layers' | 'history';

interface EditorState {
  doc: PageDocument;
  selectedSectionId: string | null;
  saving: 'idle' | 'pending' | 'saved' | 'error';
  lastSavedAt: number | null;
  /** Toggle "Auto-generate content" del sidebar Add Section. */
  autoGenerate: boolean;
}

type Action =
  | { type: 'SET_DOC'; doc: PageDocument }
  | { type: 'INSERT'; section: SectionInstance; index?: number }
  | { type: 'REMOVE'; id: string }
  | { type: 'SELECT'; id: string | null }
  | { type: 'UPDATE_PROPS'; id: string; props: Record<string, unknown> }
  | { type: 'TOGGLE_VISIBILITY'; id: string; key: string; value: boolean }
  | { type: 'REORDER'; ids: string[] }
  | { type: 'SAVING'; status: EditorState['saving'] }
  | { type: 'SAVED' }
  | { type: 'TOGGLE_AUTOGEN' };

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_DOC':
      return { ...state, doc: action.doc };
    case 'INSERT': {
      const sections = [...state.doc.sections];
      const idx = action.index ?? sections.length;
      sections.splice(idx, 0, action.section);
      return { ...state, doc: { ...state.doc, sections }, selectedSectionId: action.section.id };
    }
    case 'REMOVE':
      return {
        ...state,
        doc: { ...state.doc, sections: state.doc.sections.filter((s) => s.id !== action.id) },
        selectedSectionId: state.selectedSectionId === action.id ? null : state.selectedSectionId,
      };
    case 'SELECT':
      return { ...state, selectedSectionId: action.id };
    case 'UPDATE_PROPS':
      return {
        ...state,
        doc: {
          ...state.doc,
          sections: state.doc.sections.map((s) =>
            s.id === action.id ? { ...s, props: { ...s.props, ...action.props } } : s,
          ),
        },
      };
    case 'TOGGLE_VISIBILITY':
      return {
        ...state,
        doc: {
          ...state.doc,
          sections: state.doc.sections.map((s) =>
            s.id === action.id ? { ...s, visible: { ...(s.visible ?? {}), [action.key]: action.value } } : s,
          ),
        },
      };
    case 'REORDER': {
      const map = new Map(state.doc.sections.map((s) => [s.id, s]));
      const next = action.ids.map((id) => map.get(id)).filter(Boolean) as SectionInstance[];
      return { ...state, doc: { ...state.doc, sections: next } };
    }
    case 'SAVING':
      return { ...state, saving: action.status };
    case 'SAVED':
      return { ...state, saving: 'saved', lastSavedAt: Date.now() };
    case 'TOGGLE_AUTOGEN':
      return { ...state, autoGenerate: !state.autoGenerate };
    default:
      return state;
  }
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function Editor({ initialPage }: { initialPage: LandingPage }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    doc: initialPage.document ?? { sections: [], theme: {}, meta: {} },
    selectedSectionId: null,
    saving: 'idle',
    lastSavedAt: null,
    autoGenerate: true,
  });
  const [tool, setTool] = useState<Tool>('add');
  const [previewing, setPreviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  /* ───────── autosave debounced ───────── */
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const lastDocSentRef = useRef<string>(JSON.stringify(state.doc));
  useEffect(() => {
    const serialized = JSON.stringify(state.doc);
    if (serialized === lastDocSentRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dispatch({ type: 'SAVING', status: 'pending' });
    saveTimer.current = setTimeout(async () => {
      lastDocSentRef.current = serialized;
      try {
        const res = await fetch(`/api/landing-pages/${initialPage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: serialized,
        });
        if (!res.ok) throw new Error(await res.text());
        dispatch({ type: 'SAVED' });
      } catch (err) {
        console.error('autosave failed', err);
        dispatch({ type: 'SAVING', status: 'error' });
      }
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.doc, initialPage.id]);

  /* ───────── handlers ───────── */
  const insertSection = useCallback(async (type: string) => {
    const def = getSection(type);
    if (!def) return;
    const inst: SectionInstance = {
      id: uuid(),
      type,
      visible: { ...(def.defaultVisible ?? {}) },
      props: { ...def.defaultProps },
    };
    dispatch({ type: 'INSERT', section: inst });

    if (state.autoGenerate) {
      try {
        // Optimista: mostramos la sección con defaults; cuando llegue el fill
        // se reemplazan los props.
        const res = await fetch(`/api/landing-pages/${initialPage.id}/fill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section_ids: [inst.id] }),
        });
        const json = await res.json();
        if (res.ok && json.document) dispatch({ type: 'SET_DOC', doc: json.document });
      } catch (err) {
        console.warn('auto-fill falló', err);
      }
    }
  }, [initialPage.id, state.autoGenerate]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/landing-pages/${initialPage.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'publish failed');
      window.open(json.url, '_blank');
    } catch (err: any) {
      alert('No se pudo publicar: ' + (err?.message ?? 'error desconocido'));
    } finally {
      setPublishing(false);
    }
  }, [initialPage.id]);

  const selectedSection = state.selectedSectionId
    ? state.doc.sections.find((s) => s.id === state.selectedSectionId) ?? null
    : null;

  /* ───────── render ───────── */
  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-white">
      <TopBar
        name={initialPage.name}
        sectionsCount={state.doc.sections.length}
        status={initialPage.status}
        saving={state.saving}
        device={device}
        onDeviceChange={setDevice}
        onBack={() => router.push('/landing-lab')}
        onPreview={() => setPreviewing((p) => !p)}
        onPublish={handlePublish}
        previewing={previewing}
        publishing={publishing}
      />

      <div className="flex flex-1 overflow-hidden">
        {!previewing && (
          <>
            <LeftRail tool={tool} onChange={setTool} />
            <Panel
              tool={tool}
              doc={state.doc}
              autoGenerate={state.autoGenerate}
              onToggleAutogen={() => dispatch({ type: 'TOGGLE_AUTOGEN' })}
              onInsert={insertSection}
              onSelect={(id) => dispatch({ type: 'SELECT', id })}
              onReorder={(ids) => dispatch({ type: 'REORDER', ids })}
              onRemove={(id) => dispatch({ type: 'REMOVE', id })}
              selectedId={state.selectedSectionId}
              pageId={initialPage.id}
            />
            {selectedSection && (
              <Inspector
                section={selectedSection}
                onUpdate={(props) =>
                  dispatch({ type: 'UPDATE_PROPS', id: selectedSection.id, props })
                }
                onToggleVisibility={(key, value) =>
                  dispatch({ type: 'TOGGLE_VISIBILITY', id: selectedSection.id, key, value })
                }
              />
            )}
          </>
        )}

        <Canvas
          doc={state.doc}
          device={device}
          previewing={previewing}
          selectedId={state.selectedSectionId}
          onSelect={(id) => dispatch({ type: 'SELECT', id })}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────── TopBar ──────────────────────────── */
function TopBar({
  name,
  sectionsCount,
  status,
  saving,
  device,
  onDeviceChange,
  onBack,
  onPreview,
  onPublish,
  previewing,
  publishing,
}: {
  name: string;
  sectionsCount: number;
  status: string;
  saving: EditorState['saving'];
  device: 'desktop' | 'mobile';
  onDeviceChange: (d: 'desktop' | 'mobile') => void;
  onBack: () => void;
  onPreview: () => void;
  onPublish: () => void;
  previewing: boolean;
  publishing: boolean;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-900 bg-black px-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-900 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-400">{sectionsCount} secciones</span>
          <span className="rounded-full bg-blue-500/15 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wider text-blue-300">
            {status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-gray-800 p-0.5">
          <button
            onClick={() => onDeviceChange('desktop')}
            className={cn('rounded px-2 py-1 text-xs', device === 'desktop' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300')}
          >
            Desktop
          </button>
          <button
            onClick={() => onDeviceChange('mobile')}
            className={cn('rounded px-2 py-1 text-xs', device === 'mobile' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300')}
          >
            Mobile
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] text-gray-500">
          {saving === 'pending' && 'Guardando…'}
          {saving === 'saved' && 'Guardado'}
          {saving === 'error' && <span className="text-red-400">Error al guardar</span>}
        </span>
        <button
          onClick={onPreview}
          className="flex items-center gap-1.5 rounded-md border border-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-900"
        >
          <Eye className="h-3.5 w-3.5" />
          {previewing ? 'Salir Preview' : 'Preview'}
        </button>
        <button
          onClick={onPublish}
          disabled={publishing}
          className="flex items-center gap-1.5 rounded-md bg-[#07A498] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#06958a] disabled:opacity-50"
        >
          {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Publicar
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────── LeftRail ──────────────────────────── */
function LeftRail({ tool, onChange }: { tool: Tool; onChange: (t: Tool) => void }) {
  const items: Array<{ id: Tool; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { id: 'add', icon: Plus, label: 'Añadir sección' },
    { id: 'layers', icon: Layers, label: 'Capas' },
    { id: 'history', icon: History, label: 'Historial' },
  ];
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-gray-900 bg-black py-3">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          title={it.label}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
            tool === it.id ? 'bg-[#07A498]/15 text-[#07A498]' : 'text-gray-500 hover:bg-gray-900 hover:text-white',
          )}
        >
          <it.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────── Panel ──────────────────────────── */
function Panel(props: {
  tool: Tool;
  doc: PageDocument;
  autoGenerate: boolean;
  onToggleAutogen: () => void;
  onInsert: (type: string) => void;
  onSelect: (id: string | null) => void;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  selectedId: string | null;
  pageId: string;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-gray-900 bg-[#0d0d0d]">
      {props.tool === 'add' && (
        <AddSectionPanel
          autoGenerate={props.autoGenerate}
          onToggleAutogen={props.onToggleAutogen}
          onInsert={props.onInsert}
        />
      )}
      {props.tool === 'layers' && (
        <LayersPanel
          doc={props.doc}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
          onReorder={props.onReorder}
          onRemove={props.onRemove}
        />
      )}
      {props.tool === 'history' && <HistoryPanel pageId={props.pageId} />}
    </div>
  );
}

/* ──────────────────────────── AddSectionPanel ──────────────────────────── */
function AddSectionPanel({
  autoGenerate,
  onToggleAutogen,
  onInsert,
}: {
  autoGenerate: boolean;
  onToggleAutogen: () => void;
  onInsert: (type: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [openCategory, setOpenCategory] = useState<SectionCategory | null>('hero');

  const filteredCategories = CATEGORY_ORDER.filter(
    (cat) => cat !== 'saved' && getSectionsByCategory(cat).length > 0,
  );

  const matches = search.trim().length > 0
    ? SECTIONS.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-900 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Añadir sección</div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#07A498]" />
            <span>Auto-generar contenido</span>
          </div>
          <button
            onClick={onToggleAutogen}
            className={cn(
              'h-4 w-7 rounded-full transition-colors',
              autoGenerate ? 'bg-[#07A498]' : 'bg-gray-700',
            )}
          >
            <span
              className={cn(
                'block h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform',
                autoGenerate ? 'translate-x-3.5' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar secciones…"
          className="mt-3 w-full rounded-lg border border-gray-800 bg-black px-3 py-1.5 text-xs placeholder:text-gray-600 focus:border-[#07A498] focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {matches ? (
          matches.map((s) => (
            <button
              key={s.type}
              onClick={() => onInsert(s.type)}
              className="flex w-full items-start gap-3 px-3 py-2 text-left text-xs hover:bg-gray-900"
            >
              <div className="h-10 w-12 rounded bg-gray-800" />
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-[10px] text-gray-500">{CATEGORY_LABELS[s.category]}</div>
              </div>
            </button>
          ))
        ) : (
          filteredCategories.map((cat) => {
            const items = getSectionsByCategory(cat);
            const isOpen = openCategory === cat;
            return (
              <div key={cat} className="border-b border-gray-900/50">
                <button
                  onClick={() => setOpenCategory(isOpen ? null : cat)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-xs hover:bg-gray-900"
                >
                  <div>
                    <div className="font-semibold">{CATEGORY_LABELS[cat]}</div>
                    <div className="text-[10px] text-gray-500">{items.length} secciones</div>
                  </div>
                  <ChevronRight className={cn('h-3.5 w-3.5 text-gray-500 transition-transform', isOpen && 'rotate-90')} />
                </button>
                {isOpen && (
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    {items.map((s) => (
                      <button
                        key={s.type}
                        onClick={() => onInsert(s.type)}
                        className="rounded-md border border-gray-800 bg-[#111] p-2 text-left text-[11px] hover:border-[#07A498]"
                      >
                        <div className="mb-1.5 aspect-video rounded bg-gray-800" />
                        <div className="font-medium">{s.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────── LayersPanel ──────────────────────────── */
function LayersPanel({
  doc,
  selectedId,
  onSelect,
  onReorder,
  onRemove,
}: {
  doc: PageDocument;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = doc.sections.map((s) => s.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-900 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Capas · {doc.sections.length}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={doc.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {doc.sections.map((sec, i) => (
              <SortableLayerItem
                key={sec.id}
                section={sec}
                index={i + 1}
                selected={sec.id === selectedId}
                onSelect={() => onSelect(sec.id)}
                onRemove={() => onRemove(sec.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {doc.sections.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-gray-500">
            Aún no hay secciones. Usa "Añadir sección" para empezar.
          </div>
        )}
      </div>
    </div>
  );
}

function SortableLayerItem({
  section,
  index,
  selected,
  onSelect,
  onRemove,
}: {
  section: SectionInstance;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const def = getSection(section.type);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'mx-2 mb-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
        selected ? 'border-[#07A498] bg-[#07A498]/10' : 'border-transparent hover:border-gray-800 hover:bg-gray-900',
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-gray-600 hover:text-gray-300" title="Arrastrar">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-800 text-[10px] font-bold text-gray-400">
        {index}
      </span>
      <button onClick={onSelect} className="flex-1 text-left">
        <span className="font-medium">{def?.name ?? section.type}</span>
      </button>
      <button onClick={onRemove} className="text-gray-600 hover:text-red-400" title="Eliminar">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ──────────────────────────── HistoryPanel ──────────────────────────── */
function HistoryPanel({ pageId }: { pageId: string }) {
  const [versions, setVersions] = useState<Array<{ id: string; source: string; label: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/landing-pages/${pageId}/versions`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setVersions(j.versions ?? []);
      })
      .catch(() => null)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-900 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Historial</div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {loading && <div className="text-gray-500">Cargando…</div>}
        {!loading && versions.length === 0 && (
          <div className="text-gray-500">Aún no hay versiones guardadas. Trabaja un poco y se irán creando snapshots automáticos.</div>
        )}
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="rounded-md border border-gray-800 p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{v.label || (v.source === 'manual' ? 'Versión manual' : 'Auto')}</span>
                <span className="text-[10px] text-gray-500">{new Date(v.created_at).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-gray-800 py-2 text-xs hover:bg-gray-900">
          <Save className="h-3.5 w-3.5" />
          Guardar versión
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────── Inspector ──────────────────────────── */
function Inspector({
  section,
  onUpdate,
  onToggleVisibility,
}: {
  section: SectionInstance;
  onUpdate: (props: Record<string, unknown>) => void;
  onToggleVisibility: (key: string, value: boolean) => void;
}) {
  const def = getSection(section.type);
  if (!def) return null;
  const groups = groupSchema(def.schema);

  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-gray-900 bg-[#0d0d0d]">
      <div className="border-b border-gray-900 px-3 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{def.name}</div>
        <div className="text-[10px] text-gray-500">{def.description}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {Object.entries(groups).map(([group, fields]) => (
          <div key={group} className="mb-5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{group}</div>
            <div className="space-y-3">
              {fields.map(([key, field]) => (
                <Field
                  key={key}
                  fieldKey={key}
                  field={field}
                  value={section.props[key]}
                  visible={section.visible?.[key]}
                  onChange={(v) => onUpdate({ [key]: v })}
                  onToggleVisible={(v) => onToggleVisibility(key, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupSchema(schema: Record<string, { group?: string }>) {
  const out: Record<string, Array<[string, any]>> = {};
  for (const [key, f] of Object.entries(schema)) {
    const g = f.group ?? 'content';
    (out[g] ||= []).push([key, f]);
  }
  return out;
}

function Field({
  fieldKey,
  field,
  value,
  visible,
  onChange,
  onToggleVisible,
}: {
  fieldKey: string;
  field: any;
  value: unknown;
  visible: boolean | undefined;
  onChange: (v: unknown) => void;
  onToggleVisible: (v: boolean) => void;
}) {
  // Visibility toggles are rendered separately as switches (no input).
  if (field.group === 'visibility' || field.kind === 'toggle') {
    return (
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300">{field.label}</span>
        <button
          onClick={() => onToggleVisible(!(visible ?? true))}
          className={cn(
            'h-4 w-7 rounded-full transition-colors',
            visible ?? true ? 'bg-[#07A498]' : 'bg-gray-700',
          )}
        >
          <span className={cn('block h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform', (visible ?? true) ? 'translate-x-3.5' : 'translate-x-0.5')} />
        </button>
      </div>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-gray-400">{field.label}</span>
      {field.kind === 'text' || field.kind === 'url' ? (
        <input
          type={field.kind === 'url' ? 'url' : 'text'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded border border-gray-800 bg-black px-2 py-1.5 text-xs focus:border-[#07A498] focus:outline-none"
        />
      ) : field.kind === 'textarea' ? (
        <textarea
          value={typeof value === 'string' ? value : (Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value, null, 2) : '')}
          onChange={(e) => {
            const v = e.target.value;
            // Try JSON if it looks like one; else plain string.
            const t = v.trim();
            if (t.startsWith('[') || t.startsWith('{')) {
              try {
                onChange(JSON.parse(v));
                return;
              } catch {
                /* fall through */
              }
            }
            onChange(v);
          }}
          rows={4}
          className="w-full rounded border border-gray-800 bg-black px-2 py-1.5 text-xs focus:border-[#07A498] focus:outline-none"
        />
      ) : field.kind === 'color' ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={typeof value === 'string' && value.startsWith('#') ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-gray-800 bg-black"
          />
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 rounded border border-gray-800 bg-black px-2 py-1 text-xs"
          />
        </div>
      ) : field.kind === 'select' ? (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-gray-800 bg-black px-2 py-1.5 text-xs focus:border-[#07A498] focus:outline-none"
        >
          {field.options?.map((o: any) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === 'image' ? (
        <input
          type="url"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.recommended ? `URL imagen (${field.recommended})` : 'URL imagen'}
          className="w-full rounded border border-gray-800 bg-black px-2 py-1.5 text-xs focus:border-[#07A498] focus:outline-none"
        />
      ) : null}
      {field.hint && <span className="mt-1 block text-[10px] text-gray-600">{field.hint}</span>}
    </label>
  );
}

/* ──────────────────────────── Canvas ──────────────────────────── */
function Canvas({
  doc,
  device,
  previewing,
  selectedId,
  onSelect,
}: {
  doc: PageDocument;
  device: 'desktop' | 'mobile';
  previewing: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const frameWidth = device === 'mobile' ? 390 : 1280;

  return (
    <div className="flex-1 overflow-y-auto bg-[#161616]">
      <div className="mx-auto py-6" style={{ width: frameWidth + 40, maxWidth: '100%' }}>
        <div
          className="overflow-hidden rounded-lg bg-white text-black shadow-2xl"
          style={{ width: frameWidth, maxWidth: '100%' }}
        >
          {doc.sections.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-gray-400">
              Empieza añadiendo una sección desde el panel izquierdo.
            </div>
          ) : (
            doc.sections.map((sec) => {
              const def = getSection(sec.type);
              if (!def) return null;
              const Comp = def.Component;
              const merged = { ...def.defaultProps, ...sec.props };
              const visible = { ...(def.defaultVisible ?? {}), ...(sec.visible ?? {}) };
              return (
                <div
                  key={sec.id}
                  onClick={(e) => {
                    if (previewing) return;
                    e.stopPropagation();
                    onSelect(sec.id);
                  }}
                  className={cn(
                    'relative',
                    !previewing && 'cursor-pointer outline-2 outline-offset-[-2px] hover:outline hover:outline-[#07A498]/50',
                    !previewing && sec.id === selectedId && 'outline outline-[#07A498]',
                  )}
                >
                  <Comp values={merged} theme={doc.theme ?? {}} visible={visible} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
