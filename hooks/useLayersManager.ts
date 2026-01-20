import { useState, useEffect, useCallback } from 'react';
import { fabric } from 'fabric';
import { CanvasLayer } from '@/types/canvas';
import {
  getCanvasLayers,
  toggleLayerVisibility,
  toggleLayerLock,
  reorderLayer,
  removeLayer,
  duplicateLayer,
  renameLayer,
  updateLayerOpacity,
} from '@/lib/canvas-utils';

interface UseLayersManagerProps {
  canvas: fabric.Canvas | null;
}

export function useLayersManager({ canvas }: UseLayersManagerProps) {
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Update layers when canvas changes
  const refreshLayers = useCallback(() => {
    if (!canvas) {
      setLayers([]);
      return;
    }
    
    const currentLayers = getCanvasLayers(canvas);
    setLayers(currentLayers);
  }, [canvas]);

  // Listen to canvas events
  useEffect(() => {
    if (!canvas) return;

    const handleObjectAdded = () => refreshLayers();
    const handleObjectRemoved = () => refreshLayers();
    const handleObjectModified = () => refreshLayers();
    const handleSelectionCreated = (e: fabric.IEvent) => {
      const obj = e.selected?.[0];
      if (obj && obj.name) {
        setSelectedLayerId(obj.name);
      }
    };
    const handleSelectionUpdated = (e: fabric.IEvent) => {
      const obj = e.selected?.[0];
      if (obj && obj.name) {
        setSelectedLayerId(obj.name);
      }
    };
    const handleSelectionCleared = () => {
      setSelectedLayerId(null);
    };

    canvas.on('object:added', handleObjectAdded);
    canvas.on('object:removed', handleObjectRemoved);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:created', handleSelectionCreated);
    canvas.on('selection:updated', handleSelectionUpdated);
    canvas.on('selection:cleared', handleSelectionCleared);

    // Initial refresh
    refreshLayers();

    return () => {
      canvas.off('object:added', handleObjectAdded);
      canvas.off('object:removed', handleObjectRemoved);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('selection:created', handleSelectionCreated);
      canvas.off('selection:updated', handleSelectionUpdated);
      canvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [canvas, refreshLayers]);

  const handleToggleVisibility = useCallback((layerId: string) => {
    if (!canvas) return;
    toggleLayerVisibility(canvas, layerId);
    refreshLayers();
  }, [canvas, refreshLayers]);

  const handleToggleLock = useCallback((layerId: string) => {
    if (!canvas) return;
    toggleLayerLock(canvas, layerId);
    refreshLayers();
  }, [canvas, refreshLayers]);

  const handleReorder = useCallback((layerId: string, newIndex: number) => {
    if (!canvas) return;
    reorderLayer(canvas, layerId, newIndex);
    refreshLayers();
  }, [canvas, refreshLayers]);

  const handleRemove = useCallback((layerId: string) => {
    if (!canvas) return;
    removeLayer(canvas, layerId);
    refreshLayers();
  }, [canvas, refreshLayers]);

  const handleDuplicate = useCallback((layerId: string) => {
    if (!canvas) return;
    const newLayer = duplicateLayer(canvas, layerId);
    if (newLayer) {
      refreshLayers();
      setSelectedLayerId(newLayer.id);
    }
  }, [canvas, refreshLayers]);

  const handleRename = useCallback((layerId: string, newName: string) => {
    if (!canvas) return;
    renameLayer(canvas, layerId, newName);
    refreshLayers();
  }, [canvas, refreshLayers]);

  const handleUpdateOpacity = useCallback((layerId: string, opacity: number) => {
    if (!canvas) return;
    updateLayerOpacity(canvas, layerId, opacity);
    refreshLayers();
  }, [canvas, refreshLayers]);

  const handleSelectLayer = useCallback((layerId: string) => {
    if (!canvas) return;
    
    const layer = layers.find(l => l.id === layerId);
    if (layer && layer.fabricObject) {
      canvas.setActiveObject(layer.fabricObject);
      canvas.renderAll();
      setSelectedLayerId(layerId);
    }
  }, [canvas, layers]);

  return {
    layers,
    selectedLayerId,
    refreshLayers,
    toggleVisibility: handleToggleVisibility,
    toggleLock: handleToggleLock,
    reorder: handleReorder,
    remove: handleRemove,
    duplicate: handleDuplicate,
    rename: handleRename,
    updateOpacity: handleUpdateOpacity,
    selectLayer: handleSelectLayer,
  };
}
