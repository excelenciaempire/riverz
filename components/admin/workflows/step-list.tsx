'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Step } from '@/lib/workflows/types';
import type { AvailableVariable } from '@/lib/workflows/collect-variables';
import { collectAvailableVariables } from '@/lib/workflows/collect-variables';
import { StepCard } from './step-card';
import { useWorkflow } from './workflow-context';

interface Props {
  steps: Step[];
  numberPrefix: string;
  parentNumber: string;
  onChange: (steps: Step[]) => void;
  collectVarsAt: (stepId: string) => AvailableVariable[];
  containerId: string;
}

export function StepList({
  steps,
  numberPrefix,
  parentNumber,
  onChange,
  collectVarsAt,
  containerId,
}: Props) {
  const { issuesByStep } = useWorkflow();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(steps, oldIndex, newIndex));
  }

  function updateStep(id: string, next: Step) {
    onChange(steps.map((s) => (s.id === id ? next : s)));
  }

  function removeStep(id: string) {
    onChange(steps.filter((s) => s.id !== id));
  }

  if (steps.length === 0) {
    return (
      <p className="text-xs italic text-gray-600">
        Vacío — usa la paleta de la izquierda para agregar pasos.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {steps.map((step, i) => {
            const num = parentNumber ? `${parentNumber}.${i + 1}` : `${i + 1}`;
            return (
              <StepCard
                key={step.id}
                step={step}
                number={num}
                variables={collectVarsAt(step.id)}
                hasError={(issuesByStep.get(step.id)?.length ?? 0) > 0}
                onChange={(next) => updateStep(step.id, next)}
                onRemove={() => removeStep(step.id)}
                collectVarsAt={collectVarsAt}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
