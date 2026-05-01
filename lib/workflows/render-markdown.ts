import type { Step, WorkflowDesign, AIStep, LoopStep, ConditionalStep, MergeStep, WaitStep, NoteStep, VariableDecl } from './types';

interface Ctx {
  lines: string[];
  numbering: number[];
}

export function renderWorkflowMarkdown(
  meta: { name: string; description: string | null },
  workflow: WorkflowDesign,
): string {
  const ctx: Ctx = { lines: [], numbering: [0] };
  ctx.lines.push(`# Workflow: ${meta.name || '(sin nombre)'}`);
  if (meta.description) ctx.lines.push('', `**Descripción**: ${meta.description}`);

  ctx.lines.push('', '## Inputs');
  if (workflow.inputs.length === 0) {
    ctx.lines.push('_(ninguno)_');
  } else {
    for (const v of workflow.inputs) ctx.lines.push(`- ${declLine(v)}`);
  }

  ctx.lines.push('', '## Pasos');
  if (workflow.steps.length === 0) {
    ctx.lines.push('_(ninguno)_');
  } else {
    renderSteps(workflow.steps, ctx, 3);
  }

  ctx.lines.push('', '## Output del workflow');
  if (workflow.outputs.length === 0) {
    ctx.lines.push('_(ninguno declarado)_');
  } else {
    for (const o of workflow.outputs) ctx.lines.push(`- \`${o}\``);
  }

  return ctx.lines.join('\n');
}

function declLine(v: VariableDecl): string {
  const ex = v.example ? ` _(ej: ${v.example})_` : '';
  return `\`${v.name}\` (${v.type}) — ${v.description || '_(sin descripción)_'}${ex}`;
}

function renderSteps(steps: Step[], ctx: Ctx, headingLevel: number) {
  ctx.numbering.push(0);
  for (const step of steps) {
    ctx.numbering[ctx.numbering.length - 1]++;
    const num = ctx.numbering.slice(1).join('.');
    renderStep(step, ctx, num, headingLevel);
  }
  ctx.numbering.pop();
}

function renderStep(step: Step, ctx: Ctx, num: string, headingLevel: number) {
  const h = '#'.repeat(headingLevel);

  switch (step.kind) {
    case 'ai':
      renderAI(step, ctx, num, h);
      break;
    case 'loop':
      renderLoop(step, ctx, num, h, headingLevel);
      break;
    case 'if':
      renderIf(step, ctx, num, h, headingLevel);
      break;
    case 'merge':
      renderMerge(step, ctx, num, h);
      break;
    case 'wait':
      renderWait(step, ctx, num, h);
      break;
    case 'note':
      renderNote(step, ctx, num, h);
      break;
  }
}

function renderAI(s: AIStep, ctx: Ctx, num: string, h: string) {
  const provider = s.model ? `${s.provider} · ${s.model}` : s.provider;
  ctx.lines.push('', `${h} ${num}. ${s.name} (IA · ${provider})`);
  if (s.description) ctx.lines.push('', s.description);
  if (s.promptTemplate) {
    ctx.lines.push('', '**Prompt**:', '```', s.promptTemplate, '```');
  }
  if (s.outputs.length) {
    ctx.lines.push('', '**Outputs**:');
    for (const o of s.outputs) ctx.lines.push(`- ${declLine(o)}`);
  }
  if (s.notes) ctx.lines.push('', `**Nota**: ${s.notes}`);
}

function renderLoop(s: LoopStep, ctx: Ctx, num: string, h: string, headingLevel: number) {
  const ref = s.iterateOver || '_(sin variable)_';
  ctx.lines.push('', `${h} ${num}. ${s.name} (Loop)`);
  ctx.lines.push('', `Para cada \`${s.itemAlias}\` en ${ref}:`);
  if (s.steps.length === 0) {
    ctx.lines.push('_(sin pasos anidados)_');
  } else {
    renderSteps(s.steps, ctx, headingLevel + 1);
  }
  if (s.outputs.length) {
    ctx.lines.push('', '**Outputs del loop**:');
    for (const o of s.outputs) ctx.lines.push(`- ${declLine(o)}`);
  }
}

function renderIf(s: ConditionalStep, ctx: Ctx, num: string, h: string, headingLevel: number) {
  ctx.lines.push('', `${h} ${num}. ${s.name} (Condicional)`);
  ctx.lines.push('', `**Si**: \`${s.condition || '_(sin condición)_'}\``);
  ctx.lines.push('', '**Entonces**:');
  if (s.thenSteps.length === 0) ctx.lines.push('_(sin pasos)_');
  else renderSteps(s.thenSteps, ctx, headingLevel + 1);
  ctx.lines.push('', '**Sino**:');
  if (s.elseSteps.length === 0) ctx.lines.push('_(sin pasos)_');
  else renderSteps(s.elseSteps, ctx, headingLevel + 1);
}

function renderMerge(s: MergeStep, ctx: Ctx, num: string, h: string) {
  ctx.lines.push('', `${h} ${num}. ${s.name} (Merge)`);
  if (s.description) ctx.lines.push('', s.description);
  if (s.inputs.length) {
    ctx.lines.push('', '**Inputs**:');
    for (const i of s.inputs) ctx.lines.push(`- ${i}`);
  }
  if (s.outputs.length) {
    ctx.lines.push('', '**Outputs**:');
    for (const o of s.outputs) ctx.lines.push(`- ${declLine(o)}`);
  }
}

function renderWait(s: WaitStep, ctx: Ctx, num: string, h: string) {
  ctx.lines.push('', `${h} ${num}. ${s.name} (Wait)`);
  if (s.description) ctx.lines.push('', s.description);
  if (s.pollUntil) ctx.lines.push('', `**Esperar hasta**: ${s.pollUntil}`);
}

function renderNote(s: NoteStep, ctx: Ctx, num: string, h: string) {
  ctx.lines.push('', `${h} ${num}. _Nota_`, '', s.text || '_(vacía)_');
}
