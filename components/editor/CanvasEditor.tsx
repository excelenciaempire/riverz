'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Toolbar } from './Toolbar';
import { PropertiesBar } from './PropertiesBar';
import { BottomBar } from './BottomBar';
import { useResizeObserver } from '@/hooks/use-resize-observer';
import { useCredits } from '@/hooks/useCredits';
import { toast } from 'sonner';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';
import { exportCanvasForAPI, downloadCanvasAsFile } from '@/lib/canvas-export';
import { hasMasks } from '@/lib/mask-utils';
import { cn } from '@/lib/utils';

// Fabric.js types extension
declare module 'fabric' {
  namespace fabric {
    interface Canvas {
      historyProcessing: boolean;
      isDrawingMode: boolean;
    }
  }
}

type ToolType = 'select' | 'brush' | 'text' | 'arrow' | 'image' | 'mask';

export default function CanvasEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [brushSize, setBrushSize] = useState(50);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Image State
  const [hasImage, setHasImage] = useState(false);
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [previousImageSrc, setPreviousImageSrc] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [resultImageSrc, setResultImageSrc] = useState<string | null>(null);
  
  // History
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Resize Observer
  const { width: containerWidth, height: containerHeight } = useResizeObserver(wrapperRef);

  // Credits (only for validation, not displayed)
  const { credits } = useCredits();

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current || canvas) return;

    const c = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#000000',
      selection: true,
      preserveObjectStacking: true,
    });

    setCanvas(c);

    // History Events
    const saveHistory = () => {
      if (c.historyProcessing) return;
      const json = JSON.stringify(c.toJSON(['name', 'isMask', 'selectable', 'evented']));
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(json);
        if (newHistory.length > 50) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    };

    c.on('object:added', saveHistory);
    c.on('object:modified', saveHistory);
    c.on('object:removed', saveHistory);
    c.on('path:created', (e) => {
      if (activeTool === 'mask') {
        // Mark the path as mask with blue color
        const path = e.path;
        if (path) {
          // @ts-ignore
          path.isMask = true;
          path.set({
            stroke: 'rgba(59, 130, 246, 0.7)', // Blue color
            fill: 'rgba(59, 130, 246, 0.3)',
            strokeWidth: brushSize,
            selectable: true,
            evented: true,
          });
          c.renderAll();
        }
      }
      saveHistory();
    });

    return () => {
      c.dispose();
    };
  }, [canvasRef, canvas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Resize
  useEffect(() => {
    if (!canvas || !containerWidth || !containerHeight) return;
    
    canvas.setWidth(containerWidth);
    canvas.setHeight(containerHeight);
    
    const objects = canvas.getObjects();
    const bgImage = objects.find(o => o.type === 'image' && !o.evented); 
    
    if (bgImage) {
      const scale = Math.min(
        containerWidth / (bgImage.width || 1),
        containerHeight / (bgImage.height || 1)
      ) * 0.9;
      
      bgImage.scale(scale);
      bgImage.set({
        left: containerWidth / 2,
        top: containerHeight / 2
      });
      bgImage.setCoords();
    }
    
    canvas.renderAll();
  }, [canvas, containerWidth, containerHeight]);

  // Tool Switching
  useEffect(() => {
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'default';

    if (activeTool === 'brush') {
      canvas.isDrawingMode = true;
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = '#ffffff';
    } else if (activeTool === 'mask') {
      canvas.isDrawingMode = true;
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      }
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = 'rgba(59, 130, 246, 0.7)'; // Blue for mask
    } else if (activeTool === 'select') {
      canvas.selection = true;
    }
  }, [activeTool, canvas, brushSize]);

  // Actions
  const handleAddText = useCallback(() => {
    if (!canvas) return;
    const text = new fabric.IText('Doble clic para editar', {
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      fill: '#ffffff',
      fontSize: 40,
      originX: 'center',
      originY: 'center',
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    setActiveTool('select');
  }, [canvas]);

  const handleAddArrow = useCallback(() => {
    if (!canvas) return;
    
    const centerX = canvas.width! / 2;
    const centerY = canvas.height! / 2;
    const arrowLength = 150;
    
    // Create line
    const line = new fabric.Line([
      centerX - arrowLength/2, centerY,
      centerX + arrowLength/2, centerY
    ], {
      stroke: '#ffffff',
      strokeWidth: 3,
      selectable: true,
      evented: true,
    });

    // Create arrowhead (triangle)
    const arrowHead = new fabric.Triangle({
      left: centerX + arrowLength/2,
      top: centerY,
      originX: 'center',
      originY: 'center',
      width: 15,
      height: 15,
      fill: '#ffffff',
      angle: 90,
      selectable: false,
      evented: false,
    });

    // Group them together
    const arrow = new fabric.Group([line, arrowHead], {
      left: centerX,
      top: centerY,
      originX: 'center',
      originY: 'center',
    });

    canvas.add(arrow);
    canvas.setActiveObject(arrow);
    canvas.renderAll();
    setActiveTool('select');
  }, [canvas]);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        const url = e.target.result;
        loadOverlayImage(url);
      }
    };
    reader.readAsDataURL(file);
  }, [canvas]);

  const loadOverlayImage = useCallback((url: string) => {
    if (!canvas) return;
    
    fabric.Image.fromURL(url, (img) => {
      if (!canvas) return;
      const canvasWidth = canvas.width || 800;
      const canvasHeight = canvas.height || 600;
      
      const scale = Math.min(
        canvasWidth / (img.width || 1) / 4,
        canvasHeight / (img.height || 1) / 4
      );

      img.scale(scale);
      img.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: 'center',
        originY: 'center',
        selectable: true,
        evented: true,
      });
      
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    });
  }, [canvas]);

  const loadBaseImage = useCallback((url: string) => {
    if (!canvas) return;
    canvas.clear();
    canvas.setBackgroundColor('#000000', canvas.renderAll.bind(canvas));
    
    fabric.Image.fromURL(url, (img) => {
      if (!canvas) return;
      const canvasWidth = canvas.width || 800;
      const canvasHeight = canvas.height || 600;
      
      const scale = Math.min(
        canvasWidth / (img.width || 1),
        canvasHeight / (img.height || 1)
      ) * 0.9;

      img.scale(scale);
      img.set({
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        name: 'background',
      });
      
      canvas.add(img);
      canvas.sendToBack(img);
      canvas.renderAll();
      
      const json = JSON.stringify(canvas.toJSON(['name', 'isMask', 'selectable', 'evented']));
      setHistory([json]);
      setHistoryIndex(0);
      setHasImage(true);
      setOriginalImageSrc(url);
      setPreviousImageSrc(url);
      setHasResult(false);
    });
  }, [canvas]);

  const handleMainImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        loadBaseImage(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  }, [loadBaseImage]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasImage) {
      setIsDragging(true);
    }
  }, [hasImage]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleMainImageUpload(imageFile);
    } else {
      toast.error('Por favor arrastra una imagen válida');
    }
  }, [handleMainImageUpload]);

  const handleGenerate = async () => {
    if (!canvas) return;
    
    if (!hasMasks(canvas) && !prompt.trim()) {
      toast.error('Por favor añade máscaras o escribe un prompt');
      return;
    }

    if (credits < 100) {
      toast.error('Créditos insuficientes. Necesitas 100 créditos.');
      return;
    }

    setIsGenerating(true);

    try {
      const currentSnapshot = canvas.toDataURL({ format: 'png' });
      setPreviousImageSrc(currentSnapshot);

      const exportData = exportCanvasForAPI(canvas, prompt);

      const response = await fetch('/api/editar-foto/draw-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 402) {
          toast.error(`Créditos insuficientes. Necesitas ${errorData.required} créditos.`);
          setIsGenerating(false);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();
      
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(`/api/editar-foto/status/${data.jobId}`);
        const statusData = await statusResponse.json();

        if (statusData.status === 'completed') {
          clearInterval(pollInterval);
          setResultImageSrc(statusData.result_url);
          setHasResult(true);
          toast.success('Imagen generada exitosamente');
          setIsGenerating(false);
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval);
          toast.error('Error al generar imagen');
          setIsGenerating(false);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          toast.error('Tiempo de espera agotado');
          setIsGenerating(false);
        }
      }, 120000);

    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Error al generar imagen');
      setIsGenerating(false);
    }
  };

  const handleReset = useCallback(() => {
    if (originalImageSrc) {
      setHasResult(false);
      setResultImageSrc(null);
      loadBaseImage(originalImageSrc);
    }
  }, [originalImageSrc, loadBaseImage]);
  
  const handleUsePrevious = useCallback(() => {
    if (previousImageSrc) {
      setHasResult(false);
      setResultImageSrc(null);
      loadBaseImage(previousImageSrc);
    }
  }, [previousImageSrc, loadBaseImage]);

  const handleUndo = useCallback(() => {
    if (!canvas || historyIndex <= 0) return;
    canvas.historyProcessing = true;
    const prevIndex = historyIndex - 1;
    const json = history[prevIndex];
    canvas.loadFromJSON(json, () => {
      canvas.renderAll();
      canvas.historyProcessing = false;
      setHistoryIndex(prevIndex);
    });
  }, [canvas, history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (!canvas || historyIndex >= history.length - 1) return;
    canvas.historyProcessing = true;
    const nextIndex = historyIndex + 1;
    const json = history[nextIndex];
    canvas.loadFromJSON(json, () => {
      canvas.renderAll();
      canvas.historyProcessing = false;
      setHistoryIndex(nextIndex);
    });
  }, [canvas, history, historyIndex]);

  const handleClear = useCallback(() => {
    if (!canvas) return;
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.type !== 'image' || obj.evented) {
        canvas.remove(obj);
      }
    });
  }, [canvas]);

  const handleDownload = useCallback(() => {
    if (!canvas) return;
    downloadCanvasAsFile(canvas, 'riverz-edit.png');
  }, [canvas]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-black text-[var(--rvz-ink)]">
      {/* Sidebar Tools */}
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onAddText={handleAddText}
        onAddArrow={handleAddArrow}
        onClearCanvas={handleClear}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onImageUpload={handleImageUpload}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />
      
      {/* Main Content Area */}
      <div className="relative flex flex-1 flex-col">
        
        {/* Top Prompt Bar */}
        {hasImage && (
          <div className="z-10 flex w-full justify-center items-start px-4 pt-4 absolute top-0">
            <div className="w-full max-w-[600px] rounded-full bg-black/50 p-1 backdrop-blur-md border border-[var(--rvz-card-border)]">
              <Input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe lo que quieres cambiar (opcional)..."
                className="border-none bg-transparent text-center text-[var(--rvz-ink)] placeholder:text-[var(--rvz-ink-muted)] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
        )}

        <PropertiesBar
          activeTool={activeTool}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
        />
        
        {/* Canvas / Workspace */}
        <div 
          ref={containerRef} 
          className="flex flex-1 items-center justify-center overflow-hidden bg-[#000000] relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {!hasImage ? (
            <div className="text-center w-full h-full flex items-center justify-center p-8">
              <label className={cn(
                "group relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden",
                "min-w-[400px] min-h-[300px] flex items-center justify-center",
                isDragging
                  ? "border-[var(--rvz-ink)] bg-[var(--rvz-accent)]/10 scale-[1.02]"
                  : "border-[var(--rvz-card-border)] bg-[var(--rvz-card)]/30 hover:border-[var(--rvz-card-border)] hover:bg-[var(--rvz-card)]/50"
              )}>
                <div className="flex flex-col items-center gap-4 p-12">
                  <div className={cn(
                    "rounded-full p-5 transition-all",
                    isDragging 
                      ? "bg-[var(--rvz-accent)]/20 scale-110" 
                      : "bg-[var(--rvz-card)]/50 group-hover:bg-[var(--rvz-card)]"
                  )}>
                    <Upload className={cn(
                      "h-10 w-10 transition-all",
                      isDragging ? "text-[var(--rvz-ink)] animate-bounce" : "text-[var(--rvz-ink-muted)] group-hover:text-[var(--rvz-ink-muted)]"
                    )} />
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium text-[var(--rvz-ink)]">
                      {isDragging ? 'Suelta la imagen aquí' : 'Haz clic o arrastra una imagen'}
                    </p>
                    <p className="text-sm text-[var(--rvz-ink-muted)]">
                      Soporta JPG, PNG · Máximo 10MB
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleMainImageUpload(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-8 gap-4">
              {hasResult && previousImageSrc && (
                <div className="flex h-full flex-1 flex-col items-center justify-center rounded-2xl border border-[var(--rvz-card-border)] bg-black relative overflow-hidden">
                  <div className="absolute left-4 top-4 rounded-md bg-[var(--rvz-card)]/80 px-2 py-1 text-xs font-medium text-[var(--rvz-ink-muted)] backdrop-blur-sm z-10">
                    Original
                  </div>
                  <img 
                    src={previousImageSrc} 
                    alt="Original" 
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              <div 
                ref={wrapperRef}
                className={`flex h-full flex-col items-center justify-center rounded-2xl border border-[var(--rvz-card-border)] bg-black relative overflow-hidden ${hasResult ? 'flex-1' : 'w-full'}`}
              >
                {hasResult && resultImageSrc ? (
                  <>
                    <div className="absolute left-4 top-4 rounded-md bg-blue-600/80 px-2 py-1 text-xs font-medium text-[var(--rvz-ink)] backdrop-blur-sm z-10">
                      Resultado
                    </div>
                    <img 
                      src={resultImageSrc} 
                      alt="Resultado" 
                      className="max-h-full max-w-full object-contain"
                    />
                  </>
                ) : (
                  <>
                    {hasResult && (
                      <div className="absolute left-4 top-4 rounded-md bg-blue-600/80 px-2 py-1 text-xs font-medium text-[var(--rvz-ink)] backdrop-blur-sm z-10">
                        Editando
                      </div>
                    )}
                    <canvas ref={canvasRef} />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Bottom Bar - Centered */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center px-4 pb-4">
          <BottomBar
            hasImage={hasImage}
            hasResult={hasResult}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            onReset={handleReset}
            onUsePrevious={handleUsePrevious}
            onRedoGeneration={handleGenerate}
            onReplaceImage={handleMainImageUpload}
            onDownload={handleDownload}
            creditsRequired={100}
          />
        </div>
      </div>
    </div>
  );
}
