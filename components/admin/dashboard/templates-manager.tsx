'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Modal } from '@/components/admin/ui/modal';
import { FileUpload } from '@/components/admin/ui/file-upload';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, Upload, X, Check, AlertCircle, Folder, FolderPlus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// localStorage key for pending folders — folders the admin created
// explicitly via "Nueva carpeta" but that don't yet have any templates.
// Without this, an empty folder vanishes between page loads because the
// DB only knows about folders attached to at least one template row.
const PENDING_FOLDERS_KEY = 'riverz.adminTemplates.pendingFolders';

// Small reusable folder picker. Renders a button that opens a popover with
// every known folder (from API + pending state) + "Sin carpeta" + an inline
// "Crear nueva carpeta" input. Used by both per-card move-to-folder and
// bulk/single upload modals so every dropdown reflects the same source.
function FolderPicker({
  value,
  onChange,
  folderOptions,
  onCreateFolder,
  placeholder = 'Selecciona o crea…',
  disabled = false,
}: {
  value: string | null;
  onChange: (folder: string | null) => void;
  folderOptions: Array<{ name: string | null; count: number }>;
  onCreateFolder: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const display = value === null
    ? <span className="text-gray-400">Sin carpeta</span>
    : value
      ? <span className="text-white">📁 {value}</span>
      : <span className="text-gray-500">{placeholder}</span>;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-[#0a0a0a] px-3 py-2 text-sm text-left disabled:opacity-50"
      >
        {display}
        <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-lg border border-gray-700 bg-[#141414] shadow-xl">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition',
                value === null ? 'bg-gray-800 text-white' : 'text-gray-300',
              )}
            >
              Sin carpeta
            </button>
            {folderOptions.filter((f) => f.name).map((f) => (
              <button
                key={f.name as string}
                type="button"
                onClick={() => { onChange(f.name); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition flex items-center justify-between',
                  value === f.name ? 'bg-gray-800 text-white' : 'text-gray-300',
                )}
              >
                <span>📁 {f.name}</span>
                <span className="text-[10px] text-gray-500">{f.count}</span>
              </button>
            ))}
            <div className="border-t border-gray-800 p-2 flex gap-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    e.preventDefault();
                    const name = newName.trim();
                    onCreateFolder(name);
                    onChange(name);
                    setNewName('');
                    setOpen(false);
                  }
                }}
                placeholder="Nueva carpeta..."
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!newName.trim()) return;
                  const name = newName.trim();
                  onCreateFolder(name);
                  onChange(name);
                  setNewName('');
                  setOpen(false);
                }}
                disabled={!newName.trim()}
                className="bg-brand-accent text-white shrink-0"
              >
                <FolderPlus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// One row in the bulk-upload modal. Tracks the file, the metadata the admin
// can override per-row, and the lifecycle status of its upload.
interface BulkItem {
  id: string;
  file: File;
  preview: string;
  name: string;
  dims: { width: number; height: number } | null;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function TemplatesManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkCommon, setBulkCommon] = useState({ category: '', awareness_level: '', niche: '', folder: '' });
  const [folderFilter, setFolderFilter] = useState<string | 'all'>('all');
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    thumbnail_url: '',
    category: '',
    awareness_level: '',
    niche: '',
    folder: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedDims, setSelectedDims] = useState<{ width: number; height: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [movingTemplateId, setMovingTemplateId] = useState<string | null>(null);
  const [headerNewFolder, setHeaderNewFolder] = useState('');
  const [showHeaderNewFolder, setShowHeaderNewFolder] = useState(false);

  // Pending folders — names the admin created via "Nueva carpeta" but that
  // don't have any templates yet. Persisted to localStorage so they survive
  // reloads. Auto-pruned when a template is added that uses the name.
  const [pendingFolders, setPendingFolders] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDING_FOLDERS_KEY);
      if (raw) setPendingFolders(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  const persistPending = (next: string[]) => {
    setPendingFolders(next);
    try { localStorage.setItem(PENDING_FOLDERS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const addPendingFolder = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    persistPending(Array.from(new Set([...pendingFolders, trimmed])));
  };

  // Reads the file's intrinsic pixel dimensions in the browser. Cheap — no
  // upload yet, just a transient ObjectURL that gets revoked on cleanup.
  const detectImageDimensions = (file: File) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const dims = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(url);
        resolve(dims);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo leer la imagen'));
      };
      img.src = url;
    });

  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      return data.templates || [];
    },
  });

  // Folder list with counts. Re-fetched whenever templates change so the
  // dropdown stays accurate after add/move/delete.
  const { data: folders } = useQuery({
    queryKey: ['admin-templates-folders', templates?.length],
    queryFn: async (): Promise<Array<{ name: string | null; count: number }>> => {
      const res = await fetch('/api/admin/templates?folders=1');
      if (!res.ok) return [];
      const data = await res.json();
      return data.folders || [];
    },
    enabled: true,
  });

  // Single source of truth for every dropdown/filter: API folders + any
  // pending (empty) folders the admin created locally. Once a folder shows
  // up in the API response we prune it from pendingFolders so we don't
  // double-count.
  const mergedFolderOptions = useMemo<Array<{ name: string | null; count: number }>>(() => {
    const fromApi = folders || [];
    const apiNames = new Set(fromApi.map((f) => f.name).filter(Boolean) as string[]);
    const stillPending = pendingFolders.filter((n) => !apiNames.has(n));
    if (stillPending.length !== pendingFolders.length) {
      // Prune asynchronously to avoid setState during render warning.
      setTimeout(() => persistPending(stillPending), 0);
    }
    const pendingEntries = stillPending.map((n) => ({ name: n, count: 0 }));
    return [...fromApi, ...pendingEntries].sort((a, b) => {
      if (a.name === null) return 1;
      if (b.name === null) return -1;
      return (a.name || '').localeCompare(b.name || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, pendingFolders]);

  const createTemplate = useMutation({
    mutationFn: async (data: typeof formData & { width?: number; height?: number }) => {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          thumbnail_url: data.thumbnail_url,
          category: data.category || null,
          awareness_level: data.awareness_level || null,
          niche: data.niche || null,
          folder: data.folder?.trim() || null,
          width: data.width || null,
          height: data.height || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      queryClient.invalidateQueries({ queryKey: ['admin-templates-folders'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Plantilla creada');
    },
    onError: (error: any) => {
      console.error('Create template mutation error:', error);
      toast.error(error.message || 'Error al crear plantilla');
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData & { width?: number; height?: number } }) => {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          thumbnail_url: data.thumbnail_url,
          category: data.category || null,
          awareness_level: data.awareness_level || null,
          niche: data.niche || null,
          folder: data.folder?.trim() || null,
          ...(data.width ? { width: data.width } : {}),
          ...(data.height ? { height: data.height } : {}),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Plantilla actualizada');
    },
    onError: (error: any) => {
      console.error('Update template mutation error:', error);
      toast.error(error.message || 'Error al actualizar plantilla');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/templates?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      toast.success('Plantilla eliminada');
    },
    onError: (error: any) => {
      console.error('Delete template mutation error:', error);
      toast.error(error.message || 'Error al eliminar plantilla');
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop() || 'png';
    
    // Get signed URL for direct upload
    const signedUrlRes = await fetch(`/api/admin/upload?ext=${fileExt}`);
    if (!signedUrlRes.ok) {
      throw new Error('Failed to get upload URL');
    }
    
    const { signedUrl, publicUrl } = await signedUrlRes.json();
    
    // Upload directly to Supabase Storage using signed URL
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });
    
    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error('Direct upload error:', errorText);
      throw new Error('Failed to upload image to storage');
    }
    
    return publicUrl;
  };

  // ---------- Bulk upload helpers ----------
  const addBulkFiles = async (files: File[]) => {
    const newItems: BulkItem[] = [];
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const preview = URL.createObjectURL(file);
      // Strip extension from filename for the default template name.
      const defaultName = file.name.replace(/\.[^.]+$/, '');
      let dims: { width: number; height: number } | null = null;
      try {
        dims = await detectImageDimensions(file);
      } catch {
        /* leave null — backend will skip width/height */
      }
      newItems.push({ id, file, preview, name: defaultName, dims, status: 'pending' });
    }
    setBulkItems((prev) => [...prev, ...newItems]);
  };

  const updateBulkItem = (id: string, patch: Partial<BulkItem>) => {
    setBulkItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeBulkItem = (id: string) => {
    setBulkItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((it) => it.id !== id);
    });
  };

  const resetBulk = () => {
    bulkItems.forEach((it) => URL.revokeObjectURL(it.preview));
    setBulkItems([]);
    setBulkCommon({ category: '', awareness_level: '', niche: '', folder: '' });
    setIsBulkOpen(false);
  };

  // Uploads a single bulk row: pushes the file to Storage, then creates the
  // templates row. Updates the row status as it progresses so the modal
  // shows real-time per-file progress.
  const processBulkItem = async (item: BulkItem) => {
    if (!item.name.trim()) {
      updateBulkItem(item.id, { status: 'error', error: 'Falta nombre' });
      return;
    }
    updateBulkItem(item.id, { status: 'uploading', error: undefined });
    try {
      const publicUrl = await uploadImage(item.file);
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name.trim(),
          thumbnail_url: publicUrl,
          category: bulkCommon.category || null,
          awareness_level: bulkCommon.awareness_level || null,
          niche: bulkCommon.niche || null,
          folder: bulkCommon.folder?.trim() || null,
          width: item.dims?.width || null,
          height: item.dims?.height || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      updateBulkItem(item.id, { status: 'done' });
    } catch (err: any) {
      updateBulkItem(item.id, { status: 'error', error: err?.message || 'Error de subida' });
    }
  };

  const handleBulkUpload = async () => {
    const pending = bulkItems.filter((it) => it.status === 'pending' || it.status === 'error');
    if (pending.length === 0) {
      toast.error('No hay plantillas pendientes para subir');
      return;
    }
    setIsBulkUploading(true);
    // Concurrency of 3 — Supabase Storage handles parallel uploads fine but
    // we keep it bounded so a 50-image batch doesn't open 50 sockets at once.
    const MAX_PARALLEL = 3;
    for (let i = 0; i < pending.length; i += MAX_PARALLEL) {
      const batch = pending.slice(i, i + MAX_PARALLEL);
      await Promise.allSettled(batch.map(processBulkItem));
    }
    setIsBulkUploading(false);
    queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
    const successes = bulkItems.filter((it) => it.status === 'done').length;
    if (successes > 0) {
      toast.success(`${successes} plantilla(s) subidas exitosamente`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      thumbnail_url: '',
      category: '',
      awareness_level: '',
      niche: '',
      folder: '',
    });
    setEditingTemplate(null);
    setSelectedImage(null);
    setSelectedDims(null);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      thumbnail_url: template.thumbnail_url,
      category: template.category || '',
      awareness_level: template.awareness_level || '',
      niche: template.niche || '',
      folder: template.folder || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      setIsUploading(true);
      let thumbnailUrl = formData.thumbnail_url;
      let dims = selectedDims;

      // If a new image is selected, upload it (raw, no compression — the
      // signed URL upload preserves the original bytes byte-for-byte). If we
      // somehow missed the dim probe earlier, do it now so the row always
      // lands with width/height populated.
      if (selectedImage) {
        thumbnailUrl = await uploadImage(selectedImage);
        if (!dims) {
          try { dims = await detectImageDimensions(selectedImage); } catch { /* ignore */ }
        }
      }

      const dataToSubmit = {
        ...formData,
        thumbnail_url: thumbnailUrl,
        ...(dims ? { width: dims.width, height: dims.height } : {}),
      };

      if (editingTemplate) {
        updateTemplate.mutate({ id: editingTemplate.id, data: dataToSubmit });
      } else {
        if (!thumbnailUrl) {
          toast.error('Por favor selecciona una imagen');
          setIsUploading(false);
          return;
        }
        createTemplate.mutate(dataToSubmit);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al subir la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (template: any) => {
    if (!confirm(`¿Estás seguro de eliminar "${template.name}"?`)) return;
    deleteTemplate.mutate(template.id);
  };

  // ---------- Folder operations ----------
  const deleteFolder = useMutation({
    mutationFn: async (folderName: string | null) => {
      const folderParam = folderName === null ? '__none__' : encodeURIComponent(folderName);
      const res = await fetch(`/api/admin/templates?folder=${folderParam}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ deleted: number; folder: string | null }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      queryClient.invalidateQueries({ queryKey: ['admin-templates-folders'] });
      setFolderFilter('all');
      toast.success(`${data.deleted} plantilla(s) eliminada(s) de "${data.folder ?? 'sin carpeta'}"`);
    },
    onError: (err: any) => toast.error(err?.message || 'Error al eliminar carpeta'),
  });

  const handleDeleteFolder = (folderName: string | null) => {
    const label = folderName ?? 'Sin carpeta';
    const count = folders?.find((f) => f.name === folderName)?.count ?? 0;
    if (!confirm(`¿Eliminar TODAS las ${count} plantillas en "${label}"?\nEsta acción no se puede deshacer.`)) return;
    deleteFolder.mutate(folderName);
  };

  // Apply folder filter to the templates list. 'all' = show everything,
  // '__none__' = show only un-foldered, anything else = show that folder.
  const filteredTemplates = (templates || []).filter((t: any) => {
    if (folderFilter === 'all') return true;
    if (folderFilter === '__none__') return !t.folder;
    return t.folder === folderFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Plantillas de Static Ads</h2>
        <div className="flex gap-2 items-center">
          {showHeaderNewFolder ? (
            <div className="flex gap-1 items-center">
              <Input
                autoFocus
                value={headerNewFolder}
                onChange={(e) => setHeaderNewFolder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && headerNewFolder.trim()) {
                    addPendingFolder(headerNewFolder);
                    setFolderFilter(headerNewFolder.trim());
                    setHeaderNewFolder('');
                    setShowHeaderNewFolder(false);
                  } else if (e.key === 'Escape') {
                    setHeaderNewFolder('');
                    setShowHeaderNewFolder(false);
                  }
                }}
                placeholder="Nombre de carpeta"
                className="w-56"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!headerNewFolder.trim()) return;
                  addPendingFolder(headerNewFolder);
                  setFolderFilter(headerNewFolder.trim());
                  setHeaderNewFolder('');
                  setShowHeaderNewFolder(false);
                }}
                disabled={!headerNewFolder.trim()}
                className="bg-brand-accent text-white"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setHeaderNewFolder(''); setShowHeaderNewFolder(false); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowHeaderNewFolder(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Nueva carpeta
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsBulkOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Subir varias
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="bg-brand-accent hover:bg-brand-accent/90">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Plantilla
          </Button>
        </div>
      </div>

      {/* Folder filter bar — admin-only organisational layer. End users
          (the /crear/static-ads selector) never see this. */}
      {mergedFolderOptions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-[#0a0a0a] border border-gray-800">
          <span className="text-xs text-gray-500 mr-2">📁 Carpeta:</span>
          <button
            onClick={() => setFolderFilter('all')}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full transition',
              folderFilter === 'all'
                ? 'bg-brand-accent text-white'
                : 'bg-[#141414] text-gray-300 hover:bg-gray-800',
            )}
          >
            Todas ({templates?.length || 0})
          </button>
          {mergedFolderOptions.map((f) => {
            const value = f.name === null ? '__none__' : f.name;
            const label = f.name ?? 'Sin carpeta';
            const isActive = folderFilter === value;
            return (
              <button
                key={value}
                onClick={() => setFolderFilter(value)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full transition',
                  isActive
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#141414] text-gray-300 hover:bg-gray-800',
                )}
                title={f.name === null ? 'Plantillas sin carpeta asignada' : undefined}
              >
                {label} ({f.count})
              </button>
            );
          })}
          {folderFilter !== 'all' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeleteFolder(folderFilter === '__none__' ? null : folderFilter)}
              disabled={deleteFolder.isPending}
              className="ml-auto text-red-400 border-red-500/40 hover:bg-red-500/10 hover:border-red-500"
            >
              {deleteFolder.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Eliminar carpeta
            </Button>
          )}
        </div>
      )}

      <div className="columns-1 md:columns-2 lg:columns-4 gap-6">
        {filteredTemplates.map((template: any) => {
          return (
            <div key={template.id} className="group relative overflow-hidden rounded-2xl border border-gray-800 bg-[#141414] mb-6 break-inside-avoid">
              <div className="relative overflow-hidden bg-[#0a0a0a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={template.thumbnail_url}
                  alt={template.name}
                  className="block w-full h-auto"
                />
                {template.width && template.height && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-mono text-white">
                    {template.width}×{template.height}
                  </div>
                )}
                {template.folder && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-purple-500/80 backdrop-blur-sm text-[10px] text-white max-w-[60%] truncate" title={`Carpeta: ${template.folder}`}>
                    📁 {template.folder}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-white">{template.name}</h3>
                <p className="mt-1 text-xs text-gray-400">{template.category}</p>
                <div className="mt-3 flex gap-2 items-center">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(template)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <div className="relative flex-1 min-w-0">
                    {movingTemplateId === template.id ? (
                      <FolderPicker
                        value={template.folder || null}
                        onChange={(folderValue) => {
                          setMovingTemplateId(null);
                          fetch('/api/admin/templates/bulk-folder', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids: [template.id], folder: folderValue }),
                          }).then(async (r) => {
                            if (!r.ok) {
                              const err = await r.json().catch(() => ({}));
                              throw new Error(err.error || `HTTP ${r.status}`);
                            }
                            queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
                            queryClient.invalidateQueries({ queryKey: ['admin-templates-folders'] });
                            toast.success(folderValue ? `Movido a "${folderValue}"` : 'Quitado de su carpeta');
                          }).catch((e: any) => toast.error(e?.message || 'Error al mover'));
                        }}
                        folderOptions={mergedFolderOptions}
                        onCreateFolder={addPendingFolder}
                        placeholder="Selecciona carpeta…"
                      />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMovingTemplateId(template.id)}
                        title="Mover a carpeta"
                        className="w-full"
                      >
                        <Folder className="h-4 w-4 mr-1" />
                        {template.folder ? template.folder : 'Sin carpeta'}
                      </Button>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(template)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}>
        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
              placeholder="Ej: Template Vitaminas"
            />
          </div>
          
          <div>
            <Label className="mb-2 block">Imagen de Plantilla (se sube en su tamaño original)</Label>
            {(selectedImage || formData.thumbnail_url) ? (
              <div className="space-y-3">
                {/* Preview at native ratio — no forced 3:4 crop, no object-cover.
                    Admin sees exactly what was selected, scaled to fit the card. */}
                <div className="relative w-full overflow-hidden rounded-lg border border-gray-800 bg-[#0a0a0a] flex items-center justify-center min-h-[200px] max-h-[600px]">
                  <img
                    src={selectedImage ? URL.createObjectURL(selectedImage) : formData.thumbnail_url}
                    alt="Preview"
                    className="max-h-[600px] w-auto h-auto object-contain"
                  />
                  {(selectedDims || (editingTemplate?.width && editingTemplate?.height)) && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono text-white">
                      {(selectedDims?.width ?? editingTemplate?.width)} × {(selectedDims?.height ?? editingTemplate?.height)} px
                      {selectedImage && (
                        <span className="ml-2 text-gray-400">{(selectedImage.size / 1024 / 1024).toFixed(2)}MB</span>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedImage(null);
                    setSelectedDims(null);
                    if (!editingTemplate) {
                      setFormData({ ...formData, thumbnail_url: '' });
                    }
                  }}
                  className="w-full"
                >
                  Cambiar Imagen
                </Button>
              </div>
            ) : (
              <FileUpload
                onFilesSelected={async (files) => {
                  if (files[0]) {
                    setSelectedImage(files[0]);
                    try {
                      const dims = await detectImageDimensions(files[0]);
                      setSelectedDims(dims);
                    } catch {
                      setSelectedDims(null);
                    }
                  }
                }}
                accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
                maxSize={50 * 1024 * 1024}
                variant="minimal"
                hideFileList
              />
            )}
          </div>

          <div>
            <Label>Categoría</Label>
            <Input 
              value={formData.category} 
              onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
              placeholder="Ej: carousel, single, story"
            />
          </div>

          <div>
            <Label>Nivel de Consciencia</Label>
            <select 
              value={formData.awareness_level} 
              onChange={(e) => setFormData({ ...formData, awareness_level: e.target.value })} 
              className="w-full rounded-lg border border-gray-800 bg-[#1a1a1a] px-4 py-2 text-white"
            >
              <option value="">Seleccionar</option>
              <option value="unaware">Unaware</option>
              <option value="problem-aware">Problem Aware</option>
              <option value="solution-aware">Solution Aware</option>
            </select>
          </div>

          <div>
            <Label>Nicho</Label>
            <Input
              value={formData.niche}
              onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
              placeholder="Ej: health, beauty, fitness"
            />
          </div>

          <div>
            <Label>📁 Carpeta (admin · opcional)</Label>
            <FolderPicker
              value={formData.folder ? formData.folder : null}
              onChange={(v) => setFormData({ ...formData, folder: v || '' })}
              folderOptions={mergedFolderOptions}
              onCreateFolder={addPendingFolder}
              placeholder="Sin carpeta"
            />
            <p className="mt-1 text-[10px] text-gray-500">
              Solo visible en el admin. Los usuarios finales no ven esta etiqueta.
            </p>
          </div>

          <Button
            onClick={handleSubmit} 
            className="w-full bg-brand-accent hover:bg-brand-accent/90" 
            disabled={!formData.name || (!selectedImage && !formData.thumbnail_url) || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              editingTemplate ? 'Actualizar' : 'Crear'
            )}
          </Button>
        </div>
      </Modal>

      {/* ---------- Bulk upload modal ---------- */}
      <Modal
        isOpen={isBulkOpen}
        onClose={() => {
          if (isBulkUploading) return; // can't close mid-upload
          resetBulk();
        }}
        title={`Subir varias plantillas${bulkItems.length > 0 ? ` (${bulkItems.length})` : ''}`}
      >
        <div className="space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Common metadata + folder. The folder field accepts free text
              with autocomplete suggestions from existing folders so the
              admin can re-use a name across multiple uploads. Folder is
              admin-only — never shown to end users. */}
          <div className="space-y-3 p-4 rounded-lg bg-[#0a0a0a] border border-gray-800">
            <div>
              <Label className="text-xs">📁 Carpeta (admin · todas)</Label>
              <FolderPicker
                value={bulkCommon.folder ? bulkCommon.folder : null}
                onChange={(v) => setBulkCommon({ ...bulkCommon, folder: v || '' })}
                folderOptions={mergedFolderOptions}
                onCreateFolder={addPendingFolder}
                placeholder="Sin carpeta"
                disabled={isBulkUploading}
              />
              <p className="mt-1 text-[10px] text-gray-500">
                Para organizar y eliminar todas las plantillas del batch a la vez después. Vacío = sin carpeta.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Categoría</Label>
                <Input
                  value={bulkCommon.category}
                  onChange={(e) => setBulkCommon({ ...bulkCommon, category: e.target.value })}
                  placeholder="carousel, single..."
                />
              </div>
              <div>
                <Label className="text-xs">Awareness</Label>
                <select
                  value={bulkCommon.awareness_level}
                  onChange={(e) => setBulkCommon({ ...bulkCommon, awareness_level: e.target.value })}
                  className="w-full rounded-lg border border-gray-800 bg-[#1a1a1a] px-3 py-2 text-sm text-white"
                >
                  <option value="">—</option>
                  <option value="unaware">Unaware</option>
                  <option value="problem-aware">Problem Aware</option>
                  <option value="solution-aware">Solution Aware</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Nicho</Label>
                <Input
                  value={bulkCommon.niche}
                  onChange={(e) => setBulkCommon({ ...bulkCommon, niche: e.target.value })}
                  placeholder="health, beauty..."
                />
              </div>
            </div>
          </div>

          {/* File picker (always visible so admin can keep adding).
              maxFiles=0 = unlimited per react-dropzone — admin can drop a
              whole campaign pack at once. maxSize stays per-file so a stray
              50MB file doesn't sneak in unnoticed. */}
          <FileUpload
            onFilesSelected={(files) => {
              if (files.length > 0) addBulkFiles(files);
            }}
            accept={{ 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] }}
            maxFiles={0}
            maxSize={50 * 1024 * 1024}
            multiple
            variant="minimal"
            hideFileList
          />

          {/* Per-item rows */}
          {bulkItems.length > 0 && (
            <div className="space-y-2">
              {bulkItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#141414] p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.preview}
                    alt=""
                    className="h-16 w-16 rounded object-cover border border-gray-800 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <Input
                      value={item.name}
                      onChange={(e) => updateBulkItem(item.id, { name: e.target.value })}
                      placeholder="Nombre de la plantilla"
                      disabled={item.status === 'uploading' || item.status === 'done'}
                      className="bg-[#0a0a0a]"
                    />
                    <p className="text-[11px] text-gray-500 font-mono">
                      {item.dims ? `${item.dims.width}×${item.dims.height}px` : 'sin dims'}
                      {' · '}
                      {(item.file.size / 1024 / 1024).toFixed(2)}MB
                      {item.error && <span className="ml-2 text-red-400">· {item.error}</span>}
                    </p>
                  </div>
                  <div className="shrink-0 w-8 flex items-center justify-center">
                    {item.status === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-brand-accent" />}
                    {item.status === 'done' && <Check className="h-5 w-5 text-green-400" />}
                    {item.status === 'error' && <AlertCircle className="h-5 w-5 text-red-400" />}
                    {item.status === 'pending' && (
                      <button
                        onClick={() => removeBulkItem(item.id)}
                        className="text-gray-500 hover:text-red-400"
                        title="Quitar de la cola"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              {bulkItems.filter((i) => i.status === 'done').length} listas ·{' '}
              {bulkItems.filter((i) => i.status === 'pending').length} pendientes ·{' '}
              {bulkItems.filter((i) => i.status === 'error').length} con error
            </p>
            <div className="flex gap-2">
              {bulkItems.some((i) => i.status === 'done') && !isBulkUploading && (
                <Button variant="outline" onClick={resetBulk}>
                  Cerrar
                </Button>
              )}
              <Button
                onClick={handleBulkUpload}
                disabled={isBulkUploading || bulkItems.length === 0}
                className="bg-brand-accent hover:bg-brand-accent/90"
              >
                {isBulkUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Subir {bulkItems.filter((i) => i.status === 'pending' || i.status === 'error').length} plantilla(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

