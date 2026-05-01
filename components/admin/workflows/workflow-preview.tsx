'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { WorkflowDesign } from '@/lib/workflows/types';
import { renderWorkflowMarkdown } from '@/lib/workflows/render-markdown';

interface Props {
  meta: { name: string; description: string | null };
  workflow: WorkflowDesign;
}

export function WorkflowPreview({ meta, workflow }: Props) {
  const [mode, setMode] = useState<'markdown' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);

  const md = renderWorkflowMarkdown(meta, workflow);
  const json = JSON.stringify({ name: meta.name, description: meta.description, ...workflow }, null, 2);

  function copyForClaude() {
    const text = `${md}\n\n---\n\n\`\`\`json\n${json}\n\`\`\``;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 rounded-md border border-gray-800 bg-[#0d0d0d] p-1">
          <button
            onClick={() => setMode('markdown')}
            className={`rounded px-3 py-1 text-xs ${
              mode === 'markdown' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Markdown
          </button>
          <button
            onClick={() => setMode('json')}
            className={`rounded px-3 py-1 text-xs ${
              mode === 'json' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            JSON
          </button>
        </div>
        <button
          onClick={copyForClaude}
          className="flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar para Claude'}
        </button>
      </div>
      <pre className="flex-1 overflow-auto rounded-lg border border-gray-800 bg-[#0d0d0d] p-4 text-xs leading-relaxed text-gray-300">
        {mode === 'markdown' ? md : json}
      </pre>
    </div>
  );
}
