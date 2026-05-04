import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

type ToolType = 'select' | 'brush' | 'text' | 'arrow' | 'image' | 'mask';

interface PropertiesBarProps {
  activeTool: ToolType;
  brushSize: number;
  setBrushSize: (size: number) => void;
}

export function PropertiesBar({
  activeTool,
  brushSize,
  setBrushSize,
}: PropertiesBarProps) {
  // Only show for brush and mask tools
  if (activeTool !== 'brush' && activeTool !== 'mask') return null;

  return (
    <div className="absolute left-20 top-4 z-10 flex w-64 flex-col gap-4 rounded-xl border border-[var(--rvz-card-border)] bg-[var(--rvz-card)]/90 p-4 backdrop-blur-md">
      <div>
        <Label className="mb-2 block text-xs font-medium text-[var(--rvz-ink-muted)]">
          Tamaño del Pincel
        </Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[brushSize]}
            onValueChange={(vals) => setBrushSize(vals[0])}
            min={1}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-sm font-medium text-[var(--rvz-ink)] w-10 text-right">{brushSize}</span>
        </div>
      </div>

      {activeTool === 'mask' && (
        <div className="mt-1 rounded-lg bg-blue-900/20 border border-blue-800/30 p-2">
          <p className="text-xs text-blue-300">
            Pinta sobre las áreas que quieres editar con IA
          </p>
        </div>
      )}
    </div>
  );
}
