'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  FileText,
  Link as LinkIcon,
  StickyNote,
  Trash2,
  Loader2,
  ExternalLink,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KnowledgeItem {
  id: string;
  product_id: string;
  kind: 'text' | 'link' | 'document';
  title: string;
  content: string | null;
  source_url: string | null;
  file_storage_path: string | null;
  created_at: string;
}

type AddMode = 'text' | 'link' | 'document' | null;

/**
 * Knowledge Base section embedded inside the product detail page.
 *
 * Lives next to the existing Deep Research panel and feeds the same
 * downstream consumer: the static-ads ideation pipeline reads ALL knowledge
 * rows for a product (alongside `products.research_data`) when generating
 * concept + image_prompt batches.
 *
 * Three item kinds:
 *   - text:     a free-form brief / note pasted by the user.
 *   - link:     an external URL the system can later fetch context from
 *               (storage of fetched content is left for a future iteration).
 *   - document: a PDF/DOCX/TXT/MD upload. The original file is kept in
 *               Storage (downloadable from this UI) and an extracted
 *               markdown copy is stored on the row for the pipeline. The
 *               user only ever sees the original file.
 */
export function KnowledgeBaseSection({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const items = useQuery({
    queryKey: ['product-knowledge', productId],
    queryFn: async () => {
      const r = await fetch(`/api/products/${productId}/knowledge`);
      if (!r.ok) throw new Error('Failed to load knowledge base');
      const data = await r.json();
      return data.items as KnowledgeItem[];
    },
  });

  const resetForms = () => {
    setAddMode(null);
    setTextTitle('');
    setTextContent('');
    setLinkTitle('');
    setLinkUrl('');
    setDocTitle('');
    setDocFile(null);
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const addJson = useMutation({
    mutationFn: async (payload: { kind: 'text' | 'link'; title: string; content?: string; source_url?: string }) => {
      const r = await fetch(`/api/products/${productId}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error');
      return data.item as KnowledgeItem;
    },
    onSuccess: () => {
      toast.success('Agregado a la Knowledge Base');
      queryClient.invalidateQueries({ queryKey: ['product-knowledge', productId] });
      resetForms();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const uploadDoc = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('title', title);
      const r = await fetch(`/api/products/${productId}/knowledge/upload`, {
        method: 'POST',
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error subiendo archivo');
      return data.item as KnowledgeItem;
    },
    onSuccess: () => {
      toast.success('Documento procesado y agregado');
      queryClient.invalidateQueries({ queryKey: ['product-knowledge', productId] });
      resetForms();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const r = await fetch(`/api/products/${productId}/knowledge?itemId=${itemId}`, {
        method: 'DELETE',
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'Error eliminando');
      }
    },
    onSuccess: () => {
      toast.success('Item eliminado');
      queryClient.invalidateQueries({ queryKey: ['product-knowledge', productId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmitText = () => {
    if (!textTitle.trim() || textContent.trim().length < 5) {
      toast.error('Título y contenido son requeridos');
      return;
    }
    addJson.mutate({ kind: 'text', title: textTitle, content: textContent });
  };

  const handleSubmitLink = () => {
    if (!linkTitle.trim() || !linkUrl.trim()) {
      toast.error('Título y URL son requeridos');
      return;
    }
    let url = linkUrl.trim();
    if (!/^https?:\/\//.test(url)) url = `https://${url}`;
    addJson.mutate({ kind: 'link', title: linkTitle, source_url: url });
  };

  const handleSubmitDoc = () => {
    if (!docFile) {
      toast.error('Selecciona un archivo');
      return;
    }
    const title = docTitle.trim() || docFile.name;
    uploadDoc.mutate({ file: docFile, title });
  };

  const list = items.data || [];

  return (
    <div className="rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center font-semibold text-[var(--rvz-ink)]">
          <BookOpen className="mr-2 h-5 w-5 text-[var(--rvz-ink)]" />
          Knowledge Base
        </h3>
        {list.length > 0 && (
          <span className="text-xs text-[var(--rvz-ink-muted)]">{list.length} item{list.length === 1 ? '' : 's'}</span>
        )}
      </div>

      <p className="mb-4 text-sm text-[var(--rvz-ink-muted)]">
        Material de contexto que el sistema interno usa para generar ideas creativas: notas, briefs, documentos y enlaces. El research profundo del producto ya está incluido automáticamente — esto es para sumar contexto adicional.
      </p>

      {/* Item list */}
      {items.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--rvz-ink-muted)]" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--rvz-card-border)] bg-black/20 p-6 text-center text-sm text-[var(--rvz-ink-muted)]">
          Aún no hay items en la Knowledge Base
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((item) => (
            <KnowledgeRow key={item.id} item={item} onDelete={() => deleteItem.mutate(item.id)} deleting={deleteItem.isPending} />
          ))}
        </div>
      )}

      {/* Add controls */}
      <div className="mt-5 border-t border-[var(--rvz-card-border)] pt-4">
        {addMode === null ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddMode('text')}
              className="border-[var(--rvz-card-border)] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)]"
            >
              <StickyNote className="mr-2 h-4 w-4" />
              Agregar texto
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddMode('link')}
              className="border-[var(--rvz-card-border)] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)]"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Agregar enlace
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddMode('document')}
              className="border-[var(--rvz-card-border)] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)]"
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir documento
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-[var(--rvz-card-border)] bg-black/40 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--rvz-ink)]">
                {addMode === 'text' && 'Agregar nota / brief'}
                {addMode === 'link' && 'Agregar enlace de referencia'}
                {addMode === 'document' && 'Subir documento'}
              </h4>
              <button
                onClick={resetForms}
                className="text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]"
                aria-label="Cancelar"
                disabled={addJson.isPending || uploadDoc.isPending}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {addMode === 'text' && (
              <>
                <Input
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="Título (ej: Brief de marca)"
                  className="border-[var(--rvz-card-border)] bg-black/60 text-[var(--rvz-ink)]"
                />
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Contenido: posicionamiento, ángulos competidores, transcripción de llamadas, copy de la landing, etc."
                  className="min-h-[140px] border-[var(--rvz-card-border)] bg-black/60 text-sm text-[var(--rvz-ink)]"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSubmitText}
                    disabled={addJson.isPending}
                    className="bg-[var(--rvz-accent)] text-[var(--rvz-ink)] hover:bg-[var(--rvz-accent)]/80"
                  >
                    {addJson.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Agregar
                  </Button>
                </div>
              </>
            )}

            {addMode === 'link' && (
              <>
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Título (ej: Landing del competidor)"
                  className="border-[var(--rvz-card-border)] bg-black/60 text-[var(--rvz-ink)]"
                />
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="border-[var(--rvz-card-border)] bg-black/60 text-[var(--rvz-ink)]"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSubmitLink}
                    disabled={addJson.isPending}
                    className="bg-[var(--rvz-accent)] text-[var(--rvz-ink)] hover:bg-[var(--rvz-accent)]/80"
                  >
                    {addJson.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Agregar
                  </Button>
                </div>
              </>
            )}

            {addMode === 'document' && (
              <>
                <Input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Título (opcional — usa el nombre del archivo si lo dejas vacío)"
                  className="border-[var(--rvz-card-border)] bg-black/60 text-[var(--rvz-ink)]"
                />
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploadDoc.isPending}
                    className="border-[var(--rvz-card-border)] text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)]"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {docFile ? 'Cambiar archivo' : 'Seleccionar archivo (PDF, DOCX, TXT, MD)'}
                  </Button>
                  {docFile && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--rvz-ink)]/40 bg-[var(--rvz-accent)]/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs text-[var(--rvz-ink)]">
                        <FileText className="h-4 w-4 text-[var(--rvz-ink)]" />
                        <span className="truncate font-medium">{docFile.name}</span>
                        <span className="text-[var(--rvz-ink-muted)]">{(docFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      <button
                        onClick={() => setDocFile(null)}
                        disabled={uploadDoc.isPending}
                        className="text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]"
                        aria-label="Quitar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-[var(--rvz-ink-muted)]">
                  Se conserva el archivo original; el sistema extrae el texto en markdown internamente para usarlo de contexto.
                </p>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSubmitDoc}
                    disabled={!docFile || uploadDoc.isPending}
                    className="bg-[var(--rvz-accent)] text-[var(--rvz-ink)] hover:bg-[var(--rvz-accent)]/80"
                  >
                    {uploadDoc.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeRow({ item, onDelete, deleting }: { item: KnowledgeItem; onDelete: () => void; deleting: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const Icon = item.kind === 'document' ? FileText : item.kind === 'link' ? LinkIcon : StickyNote;
  const colorByKind: Record<string, string> = {
    document: 'text-blue-400',
    link: 'text-violet-400',
    text: 'text-amber-400',
  };

  return (
    <div className="rounded-lg border border-[var(--rvz-card-border)] bg-black/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-3 min-w-0">
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', colorByKind[item.kind])} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--rvz-ink)]">{item.title}</p>
            {item.kind === 'link' && item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline"
              >
                {item.source_url}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {item.kind === 'document' && item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
              >
                Descargar archivo original
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {item.kind === 'text' && item.content && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)]"
              >
                {expanded ? 'Ocultar' : 'Mostrar'} contenido
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-[var(--rvz-ink-muted)] hover:text-red-400 disabled:opacity-50"
          aria-label="Eliminar"
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {expanded && item.content && (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/50 p-3 text-xs text-[var(--rvz-ink-muted)]">
          {item.content}
        </pre>
      )}
    </div>
  );
}
