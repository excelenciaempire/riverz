import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { downloadFromStorage, ensureProjectTmp } from './storage.js';

interface OpenAITextBlock { type: 'text'; text: string }
interface OpenAIImageBlock {
  type: 'image_url';
  image_url: { url: string };
}
type OpenAIContent = OpenAITextBlock | OpenAIImageBlock;
interface OpenAIMessage {
  role: 'system' | 'developer' | 'user' | 'assistant';
  content: string | OpenAIContent[];
}

export interface GeminiOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Calls Gemini 3 Pro on kie.ai via the OpenAI-compatible chat completions
 * endpoint. Supports vision via image_url blocks (base64 data URIs accepted).
 *
 * Mirrors the Next.js wrapper analyzeWithGemini3Pro in lib/kie-client.ts so
 * prompts behave the same across both runtimes.
 */
export async function callGemini(messages: OpenAIMessage[], options: GeminiOptions = {}): Promise<string> {
  const { system, temperature = 0.5, maxTokens = 64000 } = options;
  if (!config.kie.apiKey) throw new Error('KIE_API_KEY not set');

  const allMessages: OpenAIMessage[] = system
    ? [{ role: 'developer', content: [{ type: 'text', text: system }] }, ...messages]
    : messages;

  const body: Record<string, any> = {
    messages: allMessages,
    stream: false,
    max_tokens: maxTokens,
    temperature,
  };

  const res = await fetch(`${config.kie.baseUrl}/gemini-3-pro/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.kie.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini (kie.ai) ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();

  if (data.choices?.[0]?.message?.content) return String(data.choices[0].message.content);
  if (typeof data.response === 'string') return data.response;
  if (typeof data.content === 'string') return data.content;

  throw new Error(`Unexpected Gemini response: ${JSON.stringify(data).slice(0, 300)}`);
}

/** Downloads an image from Supabase Storage, returns an OpenAI-compat image_url block (base64 data URI). */
export async function imageBlockFromStorage(
  storagePath: string,
  projectId: string
): Promise<OpenAIImageBlock> {
  const tmp = await ensureProjectTmp(projectId);
  const localPath = path.join(tmp, path.basename(storagePath));
  await downloadFromStorage(storagePath, localPath);
  const buf = await fs.readFile(localPath);
  const base64 = buf.toString('base64');
  const ext = path.extname(storagePath).toLowerCase();
  const mediaType =
    ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';
  return { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } };
}

/** Removes ```json fences if present, parses, throws if invalid. */
export function parseJsonFromGemini(text: string): any {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return JSON.parse(s.trim());
}
