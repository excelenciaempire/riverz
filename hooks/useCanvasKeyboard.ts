import { useEffect } from 'react';
import { fabric } from 'fabric';
import { ToolType } from '@/types/canvas';

interface UseCanvasKeyboardProps {
  canvas: fabric.Canvas | null;
  onSetTool: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onDeselect: () => void;
  enabled?: boolean;
}

export function useCanvasKeyboard({
  canvas,
  onSetTool,
  onUndo,
  onRedo,
  onDelete,
  onDuplicate,
  onGroup,
  onDeselect,
  enabled = true,
}: UseCanvasKeyboardProps) {
  useEffect(() => {
    if (!enabled || !canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Tool shortcuts (single keys)
      if (!ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            e.preventDefault();
            onSetTool('select');
            break;
          case 't':
            e.preventDefault();
            onSetTool('text');
            break;
          case 'p':
            e.preventDefault();
            onSetTool('brush');
            break;
          case 'e':
            e.preventDefault();
            onSetTool('eraser');
            break;
          case 'm':
            e.preventDefault();
            onSetTool('mask');
            break;
          case 'r':
            e.preventDefault();
            onSetTool('rectangle');
            break;
          case 'c':
            e.preventDefault();
            onSetTool('circle');
            break;
          case 'escape':
            e.preventDefault();
            onDeselect();
            break;
          case 'delete':
          case 'backspace':
            e.preventDefault();
            onDelete();
            break;
        }
      }

      // Ctrl/Cmd + Key shortcuts
      if (ctrlKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            onUndo();
            break;
          case 'd':
            e.preventDefault();
            onDuplicate();
            break;
          case 'g':
            e.preventDefault();
            onGroup();
            break;
          case 'a':
            e.preventDefault();
            selectAll();
            break;
        }
      }

      // Ctrl/Cmd + Shift + Key shortcuts
      if (ctrlKey && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            onRedo();
            break;
        }
      }

      // Arrow keys for nudging
      if (!ctrlKey && !e.shiftKey) {
        const nudgeAmount = 1;
        const activeObject = canvas.getActiveObject();
        
        if (activeObject) {
          switch (e.key) {
            case 'ArrowUp':
              e.preventDefault();
              activeObject.set('top', (activeObject.top || 0) - nudgeAmount);
              canvas.renderAll();
              break;
            case 'ArrowDown':
              e.preventDefault();
              activeObject.set('top', (activeObject.top || 0) + nudgeAmount);
              canvas.renderAll();
              break;
            case 'ArrowLeft':
              e.preventDefault();
              activeObject.set('left', (activeObject.left || 0) - nudgeAmount);
              canvas.renderAll();
              break;
            case 'ArrowRight':
              e.preventDefault();
              activeObject.set('left', (activeObject.left || 0) + nudgeAmount);
              canvas.renderAll();
              break;
          }
        }
      }

      // Shift + Arrow keys for bigger nudges
      if (!ctrlKey && e.shiftKey) {
        const nudgeAmount = 10;
        const activeObject = canvas.getActiveObject();
        
        if (activeObject) {
          switch (e.key) {
            case 'ArrowUp':
              e.preventDefault();
              activeObject.set('top', (activeObject.top || 0) - nudgeAmount);
              canvas.renderAll();
              break;
            case 'ArrowDown':
              e.preventDefault();
              activeObject.set('top', (activeObject.top || 0) + nudgeAmount);
              canvas.renderAll();
              break;
            case 'ArrowLeft':
              e.preventDefault();
              activeObject.set('left', (activeObject.left || 0) - nudgeAmount);
              canvas.renderAll();
              break;
            case 'ArrowRight':
              e.preventDefault();
              activeObject.set('left', (activeObject.left || 0) + nudgeAmount);
              canvas.renderAll();
              break;
          }
        }
      }
    };

    const selectAll = () => {
      if (!canvas) return;
      
      const allObjects = canvas.getObjects().filter(obj => {
        return obj.selectable !== false && obj.evented !== false;
      });
      
      if (allObjects.length > 0) {
        const selection = new fabric.ActiveSelection(allObjects, {
          canvas: canvas,
        });
        canvas.setActiveObject(selection);
        canvas.requestRenderAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canvas, onSetTool, onUndo, onRedo, onDelete, onDuplicate, onGroup, onDeselect, enabled]);
}
