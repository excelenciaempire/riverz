import type { Step, WorkflowDesign } from './types';
import { collectAvailableVariables, extractRefs } from './collect-variables';

export interface ValidationIssue {
  stepId: string | null;
  field: string;
  message: string;
}

/**
 * Surfaces broken {{var}} references. Non-blocking — caller decides whether
 * to disable Save or just paint a warning badge.
 */
export function validateWorkflow(workflow: WorkflowDesign): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  walk(workflow.steps);
  return issues;

  function walk(steps: Step[]) {
    for (const step of steps) {
      const available = new Set(
        collectAvailableVariables(workflow, step.id).map((v) => v.ref),
      );

      const checkRefs = (text: string, field: string) => {
        for (const ref of extractRefs(text)) {
          if (!available.has(ref)) {
            issues.push({
              stepId: step.id,
              field,
              message: `Referencia desconocida: ${ref}`,
            });
          }
        }
      };

      if (step.kind === 'ai') {
        checkRefs(step.promptTemplate, 'promptTemplate');
        checkRefs(step.notes || '', 'notes');
      }
      if (step.kind === 'loop') {
        if (step.iterateOver) checkRefs(step.iterateOver, 'iterateOver');
        walk(step.steps);
      }
      if (step.kind === 'if') {
        checkRefs(step.condition, 'condition');
        walk(step.thenSteps);
        walk(step.elseSteps);
      }
      if (step.kind === 'merge') {
        for (const inp of step.inputs) checkRefs(inp, 'inputs');
      }
      if (step.kind === 'wait') {
        if (step.pollUntil) checkRefs(step.pollUntil, 'pollUntil');
      }
    }
  }
}
