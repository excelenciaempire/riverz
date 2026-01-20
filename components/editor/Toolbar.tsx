import { Button } from '@/components/ui/button';
import { 
  MousePointer2, 
  Brush, 
  Image as ImageIcon, 
  Type, 
  Trash2,
  Undo2,
  Redo2,
  MoveRight,
  Droplet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileUpload } from '@/components/ui/file-upload';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type ToolType = 'select' | 'brush' | 'text' | 'arrow' | 'image' | 'mask';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onAddText: () => void;
  onAddArrow: () => void;
  onClearCanvas: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onImageUpload: (file: File) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Toolbar({
  activeTool,
  setActiveTool,
  onAddText,
  onAddArrow,
  onClearCanvas,
  onUndo,
  onRedo,
  onImageUpload,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <div className="z-20 flex h-full flex-col justify-between border-r border-gray-800 bg-black p-2 w-[72px]">
      {/* Top Tools */}
      <div className="flex flex-col gap-2">
        {/* Select Tool */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveTool('select')}
          className={cn(
            'h-12 w-12 rounded-xl transition-all',
            activeTool === 'select' ? 'bg-brand-accent text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          )}
          title="Seleccionar"
        >
          <MousePointer2 className="h-5 w-5" />
        </Button>

        {/* Brush Tool */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveTool('brush')}
          className={cn(
            'h-12 w-12 rounded-xl transition-all',
            activeTool === 'brush' ? 'bg-brand-accent text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          )}
          title="Pincel"
        >
          <Brush className="h-5 w-5" />
        </Button>

        {/* Text Tool */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddText}
          className="h-12 w-12 rounded-xl text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
          title="Añadir Texto"
        >
          <Type className="h-5 w-5" />
        </Button>

        {/* Arrow Tool */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddArrow}
          className="h-12 w-12 rounded-xl text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
          title="Añadir Flecha"
        >
          <MoveRight className="h-5 w-5" />
        </Button>

        {/* Image Upload */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-xl text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
              title="Añadir Imagen"
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 border-gray-800 bg-[#141414] p-3" side="right">
            <h4 className="mb-3 text-sm font-medium text-white">Añadir Imagen</h4>
            <FileUpload
              onFilesSelected={(files) => files[0] && onImageUpload(files[0])}
              accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
              variant="compact"
              hideFileList
            />
          </PopoverContent>
        </Popover>

        {/* Mask Mode */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveTool('mask')}
          className={cn(
            'h-12 w-12 rounded-xl transition-all',
            activeTool === 'mask' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          )}
          title="Máscara - Pinta sobre áreas para editar con IA"
        >
          <Droplet className="h-5 w-5" />
        </Button>
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          className="h-12 w-12 rounded-xl text-gray-400 transition-all hover:bg-gray-800 hover:text-white disabled:opacity-30"
          title="Deshacer"
        >
          <Undo2 className="h-5 w-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          className="h-12 w-12 rounded-xl text-gray-400 transition-all hover:bg-gray-800 hover:text-white disabled:opacity-30"
          title="Rehacer"
        >
          <Redo2 className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClearCanvas}
          className="h-12 w-12 rounded-xl text-red-400 transition-all hover:bg-red-900/20 hover:text-red-500"
          title="Limpiar Todo"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
