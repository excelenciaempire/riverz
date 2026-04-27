import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { downloadFromStorage, ensureProjectTmp } from './storage.js';

interface AnthropicTextBlock { type: 'text'; text: string }
interface AnthropicImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
}
type AnthropicContent = AnthropicTextBlock | AnthropicImageBlock;
interface AnthropicMessage { role: 'user' | 'assistant'; content: string | AnthropicContent[] }

export interface ClaudeOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Calls Claude Sonnet 4.6 on kie.ai using the native Anthropic Messages format.
 * Supports vision via image content blocks.
 *
 * Mirrors the Next.js wrapper in lib/kie-client.ts so prompts behave the same
 * across both runtimes.
 */
export async function callClaude(messages: AnthropicMessage[], options: ClaudeOptions = {}): Promise<string> {
  const { system, temperature = 0.5, maxTokens = 4000, model = 'claude-sonnet-4-6' } = options;
  if (!config.kie.apiKey) throw new Error('KIE_API_KEY not set');

  const body: Record<string, any> = {
    model,
    messages,
    stream: false,
    max_tokens: maxTokens,
    temperature,
  };
  if (system) body.system = system;

  const res = await fetch(`${config.kie.baseUrl}/claude/v1/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.kie.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude (kie.ai) ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();

  if (Array.isArray(data.content)) {
    const text = data.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    if (text) return text;
  }
  if (data.choices?.[0]?.message?.content) return String(data.choices[0].message.content);

  throw new Error(`Unexpected Claude response: ${JSON.stringify(data).slice(0, 300)}`);
}

/** Downloads an image from Supabase Storage, returns base64 + media_type for an Anthropic image block. */
export async function imageBlockFromStorage(
  storagePath: string,
  projectId: string
): Promise<AnthropicImageBlock> {
  const tmp = await ensureProjectTmp(projectId);
  const localPath = path.join(tmp, path.basename(storagePath));
  await downloadFromStorage(storagePath, localPath);
  const buf = await fs.readFile(localPath);
  const data = buf.toString('base64');
  const ext = path.extname(storagePath).toLowerCase();
  const media_type =
    ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';
  return { type: 'image', source: { type: 'base64', media_type, data } };
}

/** Removes ```json fences if present, parses, throws if invalid. */
export function parseJsonFromClaude(text: string): any {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return JSON.parse(s.trim());
}
