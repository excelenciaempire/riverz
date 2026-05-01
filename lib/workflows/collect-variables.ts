import type { Step, WorkflowDesign, VariableDecl } from './types';

export interface AvailableVariable {
  ref: string;
  type: string;
  description: string;
  source: 'input' | 'step' | 'loop_item';
}

/**
 * Returns every variable reference that is in scope at the position of
 * `targetStepId`. Walks the tree pre-order: inputs first, then prior siblings'
 * outputs, then loop aliases when descending into a loop body.
 */
export function collectAvailableVariables(
  workflow: WorkflowDesign,
  targetStepId: string | null,
): AvailableVariable[] {
  const out: AvailableVariable[] = [];

  for (const v of workflow.inputs) {
    out.push({
      ref: `{{inputs.${v.name}}}`,
      type: v.type,
      description: v.description,
      source: 'input',
    });
  }

  walk(workflow.steps, []);
  return out;

  function walk(steps: Step[], loopAliases: { alias: string; type: string }[]): boolean {
    for (const a of loopAliases) {
      if (!out.some((x) => x.ref === `{{${a.alias}}}`)) {
        out.push({
          ref: `{{${a.alias}}}`,
          type: a.type,
          description: 'Item del loop actual',
          source: 'loop_item',
        });
      }
    }

    for (const step of steps) {
      if (step.id === targetStepId) return true;

      if (step.kind === 'ai' || step.kind === 'merge') {
        for (const o of step.outputs) addStepOutput(step.id, o);
      }

      if (step.kind === 'loop') {
        const aliases = [...loopAliases, { alias: step.itemAlias, type: 'text' }];
        const found = walk(step.steps, aliases);
        if (found) return true;
        for (const o of step.outputs) addStepOutput(step.id, o);
      }

      if (step.kind === 'if') {
        const found1 = walk(step.thenSteps, loopAliases);
        if (found1) return true;
        const found2 = walk(step.elseSteps, loopAliases);
        if (found2) return true;
      }
    }
    return false;
  }

  function addStepOutput(stepId: string, decl: VariableDecl) {
    out.push({
      ref: `{{${stepId}.${decl.name}}}`,
      type: decl.type,
      description: decl.description,
      source: 'step',
    });
  }
}

/**
 * Extracts every {{...}} reference from a string.
 */
export function extractRefs(text: string): string[] {
  const matches = text.match(/\{\{[^}]+\}\}/g);
  return matches ? matches : [];
}
