import { fabric } from 'fabric';

// Layer Types
export type LayerType = 'background' | 'image' | 'text' | 'shape' | 'stroke' | 'mask';

export interface CanvasLayer {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  fabricObject: fabric.Object;
  isMask?: boolean;
}

// Tool Types
export type ToolType = 
  | 'select' 
  | 'brush' 
  | 'eraser' 
  | 'text' 
  | 'arrow'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'mask'
  | 'eyedropper';

// Mask Data
export interface MaskStroke {
  x: number;
  y: number;
  size: number;
}

export interface MaskData {
  strokes: MaskStroke[];
  base64Image: string;
}

// Canvas State
export interface CanvasState {
  layers: CanvasLayer[];
  selectedLayerId: string | null;
  activeTool: ToolType;
  brushSize: number;
  brushColor: string;
  backgroundColor: string;
}

// Export Data
export interface CanvasExportData {
  baseImage: string; // Base64 without masks
  maskImage?: string; // Base64 mask
  prompt?: string;
  maskStrokes?: MaskStroke[];
  preserveElements: {
    texts: TextElement[];
    shapes: ShapeElement[];
    images: ImageElement[];
  };
}

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number;
}

export interface ShapeElement {
  id: string;
  type: 'rectangle' | 'circle' | 'triangle' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rotation: number;
}

export interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// Properties
export interface TextProperties {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  textAlign: string;
  shadow?: fabric.Shadow;
}

export interface ShapeProperties {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  shadow?: fabric.Shadow;
}

export interface ImageProperties {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
}

export interface MaskProperties {
  opacity: number;
  feather: number;
}

// History
export interface HistoryState {
  json: string;
  timestamp: number;
  description: string;
}
