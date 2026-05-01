export type VariableType =
  | 'text'
  | 'number'
  | 'image_url'
  | 'video_url'
  | 'json'
  | 'list';

export type AIProvider =
  | 'kie'
  | 'gemini'
  | 'nano-banana'
  | 'veo-3'
  | 'openai'
  | 'anthropic'
  | 'other';

export interface VariableDecl {
  name: string;
  type: VariableType;
  description: string;
  example?: string;
}

export interface AIStep {
  kind: 'ai';
  id: string;
  name: string;
  description: string;
  provider: AIProvider;
  model?: string;
  promptTemplate: string;
  outputs: VariableDecl[];
  notes?: string;
}

export interface LoopStep {
  kind: 'loop';
  id: string;
  name: string;
  iterateOver: string;
  itemAlias: string;
  steps: Step[];
  outputs: VariableDecl[];
}

export interface ConditionalStep {
  kind: 'if';
  id: string;
  name: string;
  condition: string;
  thenSteps: Step[];
  elseSteps: Step[];
}

export interface MergeStep {
  kind: 'merge';
  id: string;
  name: string;
  description: string;
  inputs: string[];
  outputs: VariableDecl[];
}

export interface WaitStep {
  kind: 'wait';
  id: string;
  name: string;
  description: string;
  pollUntil?: string;
}

export interface NoteStep {
  kind: 'note';
  id: string;
  text: string;
}

export type Step =
  | AIStep
  | LoopStep
  | ConditionalStep
  | MergeStep
  | WaitStep
  | NoteStep;

export type StepKind = Step['kind'];

export interface WorkflowDesign {
  inputs: VariableDecl[];
  steps: Step[];
  outputs: string[];
}

export interface WorkflowRow {
  id: string;
  clerk_user_id: string;
  name: string;
  description: string | null;
  definition: WorkflowDesign;
  created_at: string;
  updated_at: string;
}

export const EMPTY_WORKFLOW: WorkflowDesign = {
  inputs: [],
  steps: [],
  outputs: [],
};

export function newId(prefix = 'step'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newStep(kind: StepKind): Step {
  const id = newId(kind);
  switch (kind) {
    case 'ai':
      return {
        kind: 'ai',
        id,
        name: 'Nuevo paso de IA',
        description: '',
        provider: 'kie',
        model: '',
        promptTemplate: '',
        outputs: [],
        notes: '',
      };
    case 'loop':
      return {
        kind: 'loop',
        id,
        name: 'Para cada item',
        iterateOver: '',
        itemAlias: 'item',
        steps: [],
        outputs: [],
      };
    case 'if':
      return {
        kind: 'if',
        id,
        name: 'Condicional',
        condition: '',
        thenSteps: [],
        elseSteps: [],
      };
    case 'merge':
      return {
        kind: 'merge',
        id,
        name: 'Unir resultados',
        description: '',
        inputs: [],
        outputs: [],
      };
    case 'wait':
      return {
        kind: 'wait',
        id,
        name: 'Esperar',
        description: '',
        pollUntil: '',
      };
    case 'note':
      return { kind: 'note', id, text: '' };
  }
}
