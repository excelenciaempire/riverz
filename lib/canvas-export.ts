import { fabric } from 'fabric';
import { CanvasExportData, TextElement, ShapeElement, ImageElement } from '@/types/canvas';
import { canvasToImageWithoutMasks, extractMaskFromCanvas, extractStrokeCoordinates } from './mask-utils';

/**
 * Extrae elementos de texto del canvas
 */
export function extractTextElements(canvas: fabric.Canvas): TextElement[] {
  const objects = canvas.getObjects();
  const textElements: TextElement[] = [];

  objects.forEach(obj => {
    // @ts-ignore
    if ((obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') && !obj.isMask) {
      const textObj = obj as fabric.IText;
      textElements.push({
        id: obj.name || `text-${Date.now()}`,
        text: textObj.text || '',
        x: obj.left || 0,
        y: obj.top || 0,
        fontSize: textObj.fontSize || 20,
        fontFamily: textObj.fontFamily || 'Arial',
        color: textObj.fill as string || '#ffffff',
        rotation: obj.angle || 0,
      });
    }
  });

  return textElements;
}

/**
 * Extrae elementos de forma del canvas
 */
export function extractShapeElements(canvas: fabric.Canvas): ShapeElement[] {
  const objects = canvas.getObjects();
  const shapeElements: ShapeElement[] = [];

  objects.forEach(obj => {
    // @ts-ignore
    if (!obj.isMask) {
      let shapeType: 'rectangle' | 'circle' | 'triangle' | 'line' | null = null;

      if (obj instanceof fabric.Rect) {
        shapeType = 'rectangle';
      } else if (obj instanceof fabric.Circle) {
        shapeType = 'circle';
      } else if (obj instanceof fabric.Triangle) {
        shapeType = 'triangle';
      } else if (obj instanceof fabric.Line) {
        shapeType = 'line';
      }

      if (shapeType) {
        shapeElements.push({
          id: obj.name || `shape-${Date.now()}`,
          type: shapeType,
          x: obj.left || 0,
          y: obj.top || 0,
          width: (obj.width || 0) * (obj.scaleX || 1),
          height: (obj.height || 0) * (obj.scaleY || 1),
          fill: obj.fill as string || '#ffffff',
          stroke: obj.stroke as string || '#000000',
          strokeWidth: obj.strokeWidth || 0,
          rotation: obj.angle || 0,
        });
      }
    }
  });

  return shapeElements;
}

/**
 * Extrae elementos de imagen del canvas (excepto la imagen de fondo)
 */
export function extractImageElements(canvas: fabric.Canvas): ImageElement[] {
  const objects = canvas.getObjects();
  const imageElements: ImageElement[] = [];

  objects.forEach(obj => {
    // @ts-ignore
    if (obj.type === 'image' && obj.evented && !obj.isMask) {
      imageElements.push({
        id: obj.name || `image-${Date.now()}`,
        x: obj.left || 0,
        y: obj.top || 0,
        width: (obj.width || 0) * (obj.scaleX || 1),
        height: (obj.height || 0) * (obj.scaleY || 1),
        rotation: obj.angle || 0,
        scaleX: obj.scaleX || 1,
        scaleY: obj.scaleY || 1,
      });
    }
  });

  return imageElements;
}

/**
 * Exporta el estado completo del canvas para enviar a la API
 */
export function exportCanvasForAPI(
  canvas: fabric.Canvas,
  prompt?: string
): CanvasExportData {
  const baseImage = canvasToImageWithoutMasks(canvas);
  const maskImage = extractMaskFromCanvas(canvas, []);
  const maskStrokes = extractStrokeCoordinates(canvas);

  return {
    baseImage,
    maskImage: maskImage || undefined,
    prompt,
    maskStrokes,
    preserveElements: {
      texts: extractTextElements(canvas),
      shapes: extractShapeElements(canvas),
      images: extractImageElements(canvas),
    },
  };
}

/**
 * Exporta el canvas completo como imagen (incluyendo todo)
 */
export function exportCanvasAsImage(
  canvas: fabric.Canvas,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 1.0
): string {
  return canvas.toDataURL({
    format,
    quality,
    multiplier: 1,
  });
}

/**
 * Descarga el canvas como archivo
 */
export function downloadCanvasAsFile(
  canvas: fabric.Canvas,
  filename: string = 'canvas-export.png',
  format: 'png' | 'jpeg' = 'png'
): void {
  const dataUrl = exportCanvasAsImage(canvas, format);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta metadata de capas como JSON
 */
export function exportLayersMetadata(canvas: fabric.Canvas): string {
  const objects = canvas.getObjects();
  const metadata = objects.map(obj => ({
    type: obj.type,
    name: obj.name,
    left: obj.left,
    top: obj.top,
    width: obj.width,
    height: obj.height,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    angle: obj.angle,
    visible: obj.visible,
    // @ts-ignore
    isMask: obj.isMask || false,
  }));

  return JSON.stringify(metadata, null, 2);
}

/**
 * Exporta el historial de ediciones
 */
export function exportHistory(historyStates: { json: string; timestamp: number; description: string }[]): string {
  return JSON.stringify(historyStates, null, 2);
}

/**
 * Comprime una imagen base64 reduciendo calidad
 */
export function compressBase64Image(
  base64: string,
  maxWidth: number = 2048,
  maxHeight: number = 2048,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}

/**
 * Exporta solo las máscaras como imagen
 */
export function exportMasksOnly(canvas: fabric.Canvas): string {
  return extractMaskFromCanvas(canvas, []);
}

/**
 * Prepara los datos del canvas para guardar localmente
 */
export function saveCanvasState(canvas: fabric.Canvas): string {
  return JSON.stringify(canvas.toJSON(['name', 'isMask', 'selectable', 'evented']));
}

/**
 * Carga un estado de canvas previamente guardado
 */
export function loadCanvasState(canvas: fabric.Canvas, state: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      canvas.loadFromJSON(state, () => {
        canvas.renderAll();
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}
