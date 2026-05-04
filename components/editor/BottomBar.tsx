import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RotateCcw, ArrowLeft, ArrowRight, Upload, Download } from 'lucide-react';

interface BottomBarProps {
  hasImage: boolean;
  hasResult: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onReset: () => void;
  onUsePrevious: () => void;
  onRedoGeneration: () => void;
  onReplaceImage: (file: File) => void;
  onDownload: () => void;
  creditsRequired: number;
}

export function BottomBar({
  hasImage,
  hasResult,
  isGenerating,
  onGenerate,
  onReset,
  onUsePrevious,
  onRedoGeneration,
  onReplaceImage,
  onDownload,
  creditsRequired = 100,
}: BottomBarProps) {
  if (!hasImage) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--rvz-card-border)] bg-black/90 px-4 py-3 backdrop-blur-md shadow-xl">
      {!hasResult ? (
        // Mode 1: Initial Editing
        <>
          <label className="cursor-pointer">
            <Button 
              variant="ghost" 
              className="text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)] hover:bg-[var(--rvz-bg-soft)] rounded-lg pointer-events-none"
            >
              <Upload className="mr-2 h-4 w-4" />
              Reemplazar
            </Button>
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onReplaceImage(file);
              }}
              className="hidden"
            />
          </label>

          <div className="h-6 w-px bg-[var(--rvz-bg-soft)]" />

          <Button
            onClick={onGenerate}
            disabled={isGenerating}
            className="bg-blue-600 px-6 py-2 text-[var(--rvz-ink)] hover:bg-blue-700 rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Editar ({creditsRequired} créditos)
              </>
            )}
          </Button>
        </>
      ) : (
        // Mode 2: Result Review
        <>
          <Button 
            variant="ghost" 
            onClick={onUsePrevious}
            className="text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)] hover:bg-[var(--rvz-bg-soft)] rounded-lg"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Usar Anterior
          </Button>

          <Button 
            variant="ghost"
            onClick={onRedoGeneration}
            className="text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)] hover:bg-[var(--rvz-bg-soft)] rounded-lg"
          >
            Redo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button 
            variant="ghost"
            onClick={onReset}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reiniciar
          </Button>

          <Button 
            variant="ghost"
            onClick={onDownload}
            className="text-[var(--rvz-ink-muted)] hover:text-[var(--rvz-ink)] hover:bg-[var(--rvz-bg-soft)] rounded-lg"
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar
          </Button>

          <div className="h-6 w-px bg-[var(--rvz-bg-soft)]" />

          <Button
            onClick={onGenerate}
            disabled={isGenerating}
            className="bg-blue-600 px-6 py-2 text-[var(--rvz-ink)] hover:bg-blue-700 rounded-lg font-medium transition-all shadow-lg shadow-blue-600/20"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Editar ({creditsRequired} créditos)
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
