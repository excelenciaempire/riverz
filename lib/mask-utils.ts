import { fabric } from 'fabric';
import { MaskStroke, MaskData } from '@/types/canvas';

/**
 * Extrae los objetos que son máscaras del canvas
 */
export function extractMaskObjects(canvas: fabric.Canvas): fabric.Object[] {
  const objects = canvas.getObjects();
  return objects.filter(obj => {
    // @ts-ignore - custom property
    return obj.isMask === true;
  });
}

/**
 * Extrae trazos dibujados como máscara del canvas
 */
export function extractMaskFromCanvas(
  canvas: fabric.Canvas,
  maskLayerIds: string[]
): string {
  if (!canvas) return '';

  // Create a temporary canvas for mask
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width || 800;
  tempCanvas.height = canvas.height || 800;
  const ctx = tempCanvas.getContext('2d');
  
  if (!ctx) return '';

  // Fill with black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Get mask objects
  const maskObjects = extractMaskObjects(canvas);

  // Create a temporary fabric canvas to render mask objects
  const tempFabricCanvas = new fabric.Canvas(tempCanvas);
  tempFabricCanvas.setWidth(canvas.width || 800);
  tempFabricCanvas.setHeight(canvas.height || 800);
  tempFabricCanvas.backgroundColor = '#000000';

  // Add mask objects with white color
  maskObjects.forEach(obj => {
    const cloned = fabric.util.object.clone(obj);
    
    // Convert to white for mask
    if (cloned instanceof fabric.Path || cloned instanceof fabric.Circle || cloned instanceof fabric.Rect) {
      cloned.set({
        fill: '#ffffff',
        stroke: '#ffffff',
      });
    }
    
    tempFabricCanvas.add(cloned);
  });

  tempFabricCanvas.renderAll();
  const maskBase64 = tempFabricCanvas.toDataURL({ format: 'png' });
  
  tempFabricCanvas.dispose();

  return maskBase64;
}

/**
 * Genera una imagen base64 de la máscara a partir de trazos específicos
 */
export function generateMaskImage(strokes: fabric.Path[]): string {
  if (strokes.length === 0) return '';

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 1024;
  tempCanvas.height = 1024;
  const ctx = tempCanvas.getContext('2d');
  
  if (!ctx) return '';

  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  const tempFabricCanvas = new fabric.Canvas(tempCanvas);
  tempFabricCanvas.setWidth(1024);
  tempFabricCanvas.setHeight(1024);
  tempFabricCanvas.backgroundColor = '#000000';

  strokes.forEach(stroke => {
    const cloned = fabric.util.object.clone(stroke);
    cloned.set({
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeWidth: stroke.strokeWidth || 10,
    });
    tempFabricCanvas.add(cloned);
  });

  tempFabricCanvas.renderAll();
  const result = tempFabricCanvas.toDataURL({ format: 'png' });
  
  tempFabricCanvas.dispose();
  
  return result;
}

/**
 * Combina múltiples máscaras en una sola
 */
export function combineMasks(masks: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (masks.length === 0) {
      resolve('');
      return;
    }

    if (masks.length === 1) {
      resolve(masks[0]);
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1024;
    tempCanvas.height = 1024;
    const ctx = tempCanvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    let loadedCount = 0;
    const images: HTMLImageElement[] = [];

    masks.forEach((maskBase64, index) => {
      const img = new Image();
      img.onload = () => {
        images[index] = img;
        loadedCount++;
        
        if (loadedCount === masks.length) {
          // Draw all masks with additive blending
          ctx.globalCompositeOperation = 'lighten';
          images.forEach(image => {
            ctx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);
          });
          
          resolve(tempCanvas.toDataURL('image/png'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load mask image'));
      img.src = maskBase64;
    });
  });
}

/**
 * Extrae coordenadas de trazos para enviar a la API
 */
export function extractStrokeCoordinates(canvas: fabric.Canvas): MaskStroke[] {
  const maskObjects = extractMaskObjects(canvas);
  const strokes: MaskStroke[] = [];

  maskObjects.forEach(obj => {
    if (obj instanceof fabric.Path) {
      const path = obj.path;
      if (path) {
        path.forEach(segment => {
          if (segment[0] === 'M' || segment[0] === 'L') {
            strokes.push({
              x: segment[1] as number,
              y: segment[2] as number,
              size: obj.strokeWidth || 10,
            });
          }
        });
      }
    } else if (obj instanceof fabric.Circle) {
      strokes.push({
        x: obj.left || 0,
        y: obj.top || 0,
        size: (obj.radius || 10) * 2,
      });
    }
  });

  return strokes;
}

/**
 * Convierte el canvas a imagen sin las máscaras
 */
export function canvasToImageWithoutMasks(canvas: fabric.Canvas): string {
  if (!canvas) return '';

  // Temporarily hide mask objects
  const maskObjects = extractMaskObjects(canvas);
  const originalVisibility: boolean[] = [];

  maskObjects.forEach((obj, index) => {
    originalVisibility[index] = obj.visible !== false;
    obj.visible = false;
  });

  canvas.renderAll();
  const imageBase64 = canvas.toDataURL({ format: 'png' });

  // Restore visibility
  maskObjects.forEach((obj, index) => {
    obj.visible = originalVisibility[index];
  });

  canvas.renderAll();

  return imageBase64;
}

/**
 * Aplica un filtro de suavizado (feather) a la máscara
 */
export function featherMask(maskBase64: string, featherAmount: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.filter = `blur(${featherAmount}px)`;
      ctx.drawImage(img, 0, 0);
      
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('Failed to load mask image'));
    img.src = maskBase64;
  });
}

/**
 * Verifica si hay máscaras en el canvas
 */
export function hasMasks(canvas: fabric.Canvas): boolean {
  return extractMaskObjects(canvas).length > 0;
}

/**
 * Limpia todas las máscaras del canvas
 */
export function clearMasks(canvas: fabric.Canvas): void {
  const maskObjects = extractMaskObjects(canvas);
  maskObjects.forEach(obj => {
    canvas.remove(obj);
  });
  canvas.renderAll();
}
