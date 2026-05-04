import { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, MoreVertical, Type, Image as ImageIcon, Circle, Square } from 'lucide-react';
import { CanvasLayer } from '@/types/canvas';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LayersPanelProps {
  layers: CanvasLayer[];
  selectedLayerId: string | null;
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onRemove: (layerId: string) => void;
  onDuplicate: (layerId: string) => void;
  onSelect: (layerId: string) => void;
  onRename: (layerId: string, newName: string) => void;
  onReorder: (layerId: string, newIndex: number) => void;
}

export function LayersPanel({
  layers,
  selectedLayerId,
  onToggleVisibility,
  onToggleLock,
  onRemove,
  onDuplicate,
  onSelect,
  onRename,
  onReorder,
}: LayersPanelProps) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);

  const getLayerIcon = (type: CanvasLayer['type']) => {
    switch (type) {
      case 'text':
        return <Type className="h-4 w-4" />;
      case 'image':
      case 'background':
        return <ImageIcon className="h-4 w-4" />;
      case 'shape':
        return <Square className="h-4 w-4" />;
      case 'stroke':
        return <Circle className="h-4 w-4" />;
      case 'mask':
        return <Circle className="h-4 w-4 text-red-400" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const handleStartEdit = (layer: CanvasLayer) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  const handleFinishEdit = (layerId: string) => {
    if (editingName.trim()) {
      onRename(layerId, editingName.trim());
    }
    setEditingLayerId(null);
    setEditingName('');
  };

  const handleDragStart = (e: React.DragEvent, layerId: string) => {
    setDraggedLayerId(layerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    setDragOverLayerId(layerId);
  };

  const handleDrop = (e: React.DragEvent, targetLayerId: string) => {
    e.preventDefault();
    
    if (draggedLayerId && draggedLayerId !== targetLayerId) {
      const targetIndex = layers.findIndex(l => l.id === targetLayerId);
      if (targetIndex !== -1) {
        onReorder(draggedLayerId, targetIndex);
      }
    }
    
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  };

  const handleDragEnd = () => {
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  };

  // Reverse layers to show top layer first (z-index order)
  const displayLayers = [...layers].reverse();

  return (
    <div className="flex h-full w-64 flex-col border-l border-[var(--rvz-card-border)] bg-[var(--rvz-bg)]">
      {/* Header */}
      <div className="border-b border-[var(--rvz-card-border)] p-3">
        <h3 className="text-sm font-medium text-[var(--rvz-ink)]">Capas</h3>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto">
        {displayLayers.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-center text-sm text-[var(--rvz-ink-muted)]">
              No hay capas aún
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {displayLayers.map((layer) => (
              <div
                key={layer.id}
                draggable
                onDragStart={(e) => handleDragStart(e, layer.id)}
                onDragOver={(e) => handleDragOver(e, layer.id)}
                onDrop={(e) => handleDrop(e, layer.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border p-2 transition-all',
                  selectedLayerId === layer.id
                    ? 'border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/10'
                    : 'border-[var(--rvz-card-border)] bg-[var(--rvz-card)] hover:border-[var(--rvz-card-border)]',
                  dragOverLayerId === layer.id && 'border-[var(--rvz-ink)]',
                  draggedLayerId === layer.id && 'opacity-50',
                  !layer.visible && 'opacity-60'
                )}
                onClick={() => onSelect(layer.id)}
              >
                {/* Layer Icon */}
                <div className="shrink-0 text-[var(--rvz-ink-muted)]">
                  {getLayerIcon(layer.type)}
                </div>

                {/* Layer Name */}
                <div className="flex-1 min-w-0">
                  {editingLayerId === layer.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleFinishEdit(layer.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleFinishEdit(layer.id);
                        } else if (e.key === 'Escape') {
                          setEditingLayerId(null);
                          setEditingName('');
                        }
                      }}
                      className="w-full bg-[var(--rvz-card)] px-2 py-1 text-xs text-[var(--rvz-ink)] border border-[var(--rvz-ink)] rounded outline-none"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p
                      className="truncate text-xs text-[var(--rvz-ink)]"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(layer);
                      }}
                    >
                      {layer.name}
                    </p>
                  )}
                  {layer.isMask && (
                    <span className="text-[10px] text-red-400">Máscara</span>
                  )}
                </div>

                {/* Layer Controls */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(layer.id);
                    }}
                    className="rounded p-1 hover:bg-[var(--rvz-bg-soft)] transition-colors"
                    title={layer.visible ? 'Ocultar' : 'Mostrar'}
                  >
                    {layer.visible ? (
                      <Eye className="h-3.5 w-3.5 text-[var(--rvz-ink-muted)]" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-[var(--rvz-ink-muted)]" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(layer.id);
                    }}
                    className="rounded p-1 hover:bg-[var(--rvz-bg-soft)] transition-colors"
                    title={layer.locked ? 'Desbloquear' : 'Bloquear'}
                  >
                    {layer.locked ? (
                      <Lock className="h-3.5 w-3.5 text-[var(--rvz-ink-muted)]" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5 text-[var(--rvz-ink-muted)]" />
                    )}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="rounded p-1 hover:bg-[var(--rvz-bg-soft)] transition-colors">
                        <MoreVertical className="h-3.5 w-3.5 text-[var(--rvz-ink-muted)]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[var(--rvz-card)] border-[var(--rvz-card-border)]" align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(layer);
                        }}
                        className="text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)] hover:text-[var(--rvz-ink)]"
                      >
                        Renombrar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(layer.id);
                        }}
                        className="text-[var(--rvz-ink-muted)] hover:bg-[var(--rvz-card)] hover:text-[var(--rvz-ink)]"
                      >
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(layer.id);
                        }}
                        className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-[var(--rvz-card-border)] p-3">
        <p className="text-xs text-[var(--rvz-ink-muted)]">
          {layers.length} {layers.length === 1 ? 'capa' : 'capas'}
        </p>
      </div>
    </div>
  );
}
