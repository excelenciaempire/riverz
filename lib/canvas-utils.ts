import { fabric } from 'fabric';
import { CanvasLayer, LayerType } from '@/types/canvas';

/**
 * Genera un ID único para capas
 */
export function generateLayerId(): string {
  return `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Determina el tipo de capa basado en el objeto de Fabric
 */
export function getLayerType(obj: fabric.Object): LayerType {
  // @ts-ignore
  if (obj.isMask) return 'mask';
  
  if (obj.type === 'image') {
    // @ts-ignore
    return obj.evented ? 'image' : 'background';
  }
  
  if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
    return 'text';
  }
  
  if (obj.type === 'path' || obj.type === 'line') {
    return 'stroke';
  }
  
  if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'triangle' || obj.type === 'polygon') {
    return 'shape';
  }
  
  return 'shape';
}

/**
 * Convierte un objeto de Fabric a una capa
 */
export function fabricObjectToLayer(obj: fabric.Object): CanvasLayer {
  const type = getLayerType(obj);
  
  return {
    id: obj.name || generateLayerId(),
    type,
    name: obj.name || `${type} ${Date.now()}`,
    visible: obj.visible !== false,
    locked: obj.selectable === false,
    opacity: obj.opacity || 1,
    fabricObject: obj,
    // @ts-ignore
    isMask: obj.isMask || false,
  };
}

/**
 * Obtiene todas las capas del canvas
 */
export function getCanvasLayers(canvas: fabric.Canvas): CanvasLayer[] {
  const objects = canvas.getObjects();
  return objects.map(obj => fabricObjectToLayer(obj));
}

/**
 * Encuentra una capa por ID
 */
export function findLayerById(canvas: fabric.Canvas, layerId: string): CanvasLayer | null {
  const layers = getCanvasLayers(canvas);
  return layers.find(layer => layer.id === layerId) || null;
}

/**
 * Actualiza la visibilidad de una capa
 */
export function toggleLayerVisibility(canvas: fabric.Canvas, layerId: string): void {
  const layer = findLayerById(canvas, layerId);
  if (layer) {
    layer.fabricObject.visible = !layer.visible;
    canvas.renderAll();
  }
}

/**
 * Bloquea o desbloquea una capa
 */
export function toggleLayerLock(canvas: fabric.Canvas, layerId: string): void {
  const layer = findLayerById(canvas, layerId);
  if (layer) {
    const newLockState = !layer.locked;
    layer.fabricObject.selectable = !newLockState;
    layer.fabricObject.evented = !newLockState;
    canvas.renderAll();
  }
}

/**
 * Reordena capas en el canvas
 */
export function reorderLayer(
  canvas: fabric.Canvas,
  layerId: string,
  newIndex: number
): void {
  const layer = findLayerById(canvas, layerId);
  if (layer) {
    const obj = layer.fabricObject;
    const currentIndex = canvas.getObjects().indexOf(obj);
    
    if (currentIndex !== -1 && newIndex !== currentIndex) {
      canvas.remove(obj);
      canvas.insertAt(obj, newIndex, false);
      canvas.renderAll();
    }
  }
}

/**
 * Elimina una capa del canvas
 */
export function removeLayer(canvas: fabric.Canvas, layerId: string): void {
  const layer = findLayerById(canvas, layerId);
  if (layer) {
    canvas.remove(layer.fabricObject);
    canvas.renderAll();
  }
}

/**
 * Duplica una capa
 */
export function duplicateLayer(canvas: fabric.Canvas, layerId: string): CanvasLayer | null {
  const layer = findLayerById(canvas, layerId);
  if (!layer) return null;

  const cloned = fabric.util.object.clone(layer.fabricObject);
  cloned.set({
    left: (cloned.left || 0) + 10,
    top: (cloned.top || 0) + 10,
  });
  
  const newId = generateLayerId();
  cloned.name = newId;
  
  canvas.add(cloned);
  canvas.setActiveObject(cloned);
  canvas.renderAll();
  
  return fabricObjectToLayer(cloned);
}

/**
 * Renombra una capa
 */
export function renameLayer(canvas: fabric.Canvas, layerId: string, newName: string): void {
  const layer = findLayerById(canvas, layerId);
  if (layer) {
    layer.fabricObject.name = newName;
    layer.name = newName;
  }
}

/**
 * Actualiza la opacidad de una capa
 */
export function updateLayerOpacity(canvas: fabric.Canvas, layerId: string, opacity: number): void {
  const layer = findLayerById(canvas, layerId);
  if (layer) {
    layer.fabricObject.opacity = Math.max(0, Math.min(1, opacity));
    canvas.renderAll();
  }
}

/**
 * Agrupa objetos seleccionados
 */
export function groupSelectedObjects(canvas: fabric.Canvas): fabric.Group | null {
  const activeObject = canvas.getActiveObject();
  
  if (!activeObject) return null;
  
  if (activeObject.type !== 'activeSelection') {
    return null;
  }

  const activeSelection = activeObject as fabric.ActiveSelection;
  const group = activeSelection.toGroup();
  canvas.requestRenderAll();
  
  return group;
}

/**
 * Desagrupa un grupo
 */
export function ungroupObject(canvas: fabric.Canvas, obj: fabric.Object): void {
  if (obj.type !== 'group') return;
  
  const group = obj as fabric.Group;
  const items = group.getObjects();
  
  group._restoreObjectsState();
  canvas.remove(group);
  
  items.forEach(item => {
    canvas.add(item);
  });
  
  canvas.renderAll();
}

/**
 * Centra un objeto en el canvas
 */
export function centerObject(canvas: fabric.Canvas, obj: fabric.Object): void {
  obj.center();
  canvas.renderAll();
}

/**
 * Ajusta el zoom del canvas
 */
export function setCanvasZoom(canvas: fabric.Canvas, zoomLevel: number): void {
  const center = canvas.getCenter();
  canvas.zoomToPoint(
    new fabric.Point(center.left, center.top),
    Math.max(0.1, Math.min(5, zoomLevel))
  );
}

/**
 * Resetea el zoom del canvas
 */
export function resetCanvasZoom(canvas: fabric.Canvas): void {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
}

/**
 * Obtiene los límites del canvas con todos los objetos
 */
export function getCanvasBounds(canvas: fabric.Canvas): { 
  left: number; 
  top: number; 
  width: number; 
  height: number;
} {
  const objects = canvas.getObjects();
  
  if (objects.length === 0) {
    return { left: 0, top: 0, width: canvas.width || 0, height: canvas.height || 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  objects.forEach(obj => {
    const bounds = obj.getBoundingRect();
    minX = Math.min(minX, bounds.left);
    minY = Math.min(minY, bounds.top);
    maxX = Math.max(maxX, bounds.left + bounds.width);
    maxY = Math.max(maxY, bounds.top + bounds.height);
  });

  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Limpia el canvas completamente
 */
export function clearCanvas(canvas: fabric.Canvas): void {
  canvas.clear();
  canvas.backgroundColor = '#1a1a1a';
  canvas.renderAll();
}

/**
 * Crea una marca de máscara en el canvas
 */
export function createMaskBrush(canvas: fabric.Canvas, size: number = 30): void {
  canvas.isDrawingMode = true;
  
  if (!canvas.freeDrawingBrush) {
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  }
  
  canvas.freeDrawingBrush.color = 'rgba(59, 130, 246, 0.7)'; // Blue semi-transparent
  canvas.freeDrawingBrush.width = size;
}

/**
 * Marca el último path creado como máscara
 */
export function markLastPathAsMask(canvas: fabric.Canvas): void {
  const objects = canvas.getObjects();
  const lastPath = objects[objects.length - 1];
  
  if (lastPath && lastPath.type === 'path') {
    // @ts-ignore
    lastPath.isMask = true;
    lastPath.set({
      stroke: 'rgba(59, 130, 246, 0.7)',
      fill: 'rgba(59, 130, 246, 0.3)',
      selectable: true,
    });
    canvas.renderAll();
  }
}
