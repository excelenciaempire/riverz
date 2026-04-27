import { createClient } from '@/lib/supabase/server';

const KIE_API_KEY = process.env.KIE_API_KEY;
if (!KIE_API_KEY) {
  console.warn('[KIE] KIE_API_KEY env var is not set. All kie.ai calls will fail until configured.');
}
const KIE_BASE_URL = process.env.KIE_BASE_URL || 'https://api.kie.ai';

const DEFAULT_ANALYSIS_MODEL = 'claude-sonnet-4-6';
const DEFAULT_GENERATION_MODEL = 'nano-banana-pro';

// --- Types ---
export interface KieTaskResult {
  taskId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  result?: any;
  error?: string;
}

export interface GeminiMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

// Claude message with base64 image support
export interface ClaudeImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string; // Clean base64 without prefix
  };
}

export interface ClaudeTextContent {
  type: 'text';
  text: string;
}

export type ClaudeContent = ClaudeTextContent | ClaudeImageContent;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContent[];
}

// Nano Banana Pro input interface based on Kie.ai docs
export interface NanoBananaInput {
  prompt: string;
  image_input?: string[]; // Up to 8 reference images (base64 or URLs)
  aspect_ratio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9' | 'auto';
  resolution?: '1K' | '2K' | '4K';
  output_format?: 'png' | 'jpg';
}

// Polling options
export interface PollOptions {
  intervalMs?: number;
  maxAttempts?: number;
  onProgress?: (status: string, attempt: number) => void;
}

// --- Image Utilities ---

/**
 * Strips the data URI prefix from a base64 string
 * Input: "data:image/jpeg;base64,ABC123..."
 * Output: "ABC123..."
 */
export function stripBase64Prefix(base64: string): string {
  if (!base64) return '';
  return base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
}

/**
 * Extracts the media type from a data URI
 * Input: "data:image/jpeg;base64,ABC123..."
 * Output: "image/jpeg"
 */
export function getMediaTypeFromDataUri(dataUri: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const match = dataUri.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  if (match) {
    const type = match[1].toLowerCase();
    if (type === 'image/jpeg' || type === 'image/jpg') return 'image/jpeg';
    if (type === 'image/png') return 'image/png';
    if (type === 'image/gif') return 'image/gif';
    if (type === 'image/webp') return 'image/webp';
  }
  return 'image/jpeg'; // Default
}

/**
 * Hosts whose images we are willing to download server-side. This is the
 * allowlist that prevents SSRF — the function is called with URLs that come
 * from the database (templates, products, kie.ai task results), and an
 * attacker who can write to those tables could otherwise force us to fetch
 * `http://localhost/admin` or AWS metadata. Any host not in this list is
 * rejected before fetch happens.
 *
 * Add subdomains explicitly — the check is suffix-based on the bare hostname.
 */
const SSRF_ALLOWED_SUFFIXES = [
  '.supabase.co',
  '.supabase.in',
  '.kie.ai',
  '.googleusercontent.com',
  '.googleapis.com',
  '.cloudfront.net',
  '.r2.cloudflarestorage.com',
  '.amazonaws.com',
  '.openai.com',
  '.elevenlabs.io',
  // Riverz-owned CDN domains
  'riverzai.com',
  'cdn.riverzai.com',
];

function assertHostAllowed(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }
  // Reject anything that resolves to localhost / link-local / metadata IPs
  // syntactically (best-effort; full DNS rebinding protection requires more).
  const host = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost', '127.', '0.0.0.0', '::1',
    '169.254.', '10.', '192.168.',
    '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.',
    '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.',
    '172.28.', '172.29.', '172.30.', '172.31.',
  ];
  if (blocked.some((p) => host === p.replace(/\.$/, '') || host.startsWith(p))) {
    throw new Error(`Blocked private/loopback host: ${host}`);
  }
  const ok = SSRF_ALLOWED_SUFFIXES.some(
    (s) => host === s.replace(/^\./, '') || host.endsWith(s)
  );
  if (!ok) {
    throw new Error(`Host not in SSRF allowlist: ${host}`);
  }
  return parsed;
}

/**
 * Downloads an image from URL and converts it to base64 data URI.
 * Validates the host against an allowlist before fetching.
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const safeUrl = assertHostAllowed(url);
    console.log(`[IMAGE] Converting to base64: ${safeUrl.host}${safeUrl.pathname.substring(0, 30)}...`);

    const response = await fetch(safeUrl.toString(), {
      headers: {
        'Accept': 'image/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Return as data URI for Gemini format
    const dataUri = `data:${contentType};base64,${base64}`;
    console.log(`[IMAGE] Converted successfully, size: ${Math.round(base64.length / 1024)}KB`);
    
    return dataUri;
  } catch (error) {
    console.error(`[IMAGE] Error converting image:`, error);
    throw error;
  }
}

/**
 * Downloads an image and returns clean base64 (without prefix)
 */
export async function imageUrlToCleanBase64(url: string): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
  const dataUri = await imageUrlToBase64(url);
  return {
    base64: stripBase64Prefix(dataUri),
    mediaType: getMediaTypeFromDataUri(dataUri)
  };
}

/**
 * Converts multiple image URLs to base64 data URIs
 */
export async function convertImagesToBase64(urls: string[]): Promise<string[]> {
  const results: string[] = [];
  
  for (const url of urls) {
    if (url && url.startsWith('http')) {
      try {
        const base64 = await imageUrlToBase64(url);
        results.push(base64);
      } catch (error) {
        console.error(`[IMAGE] Skipping failed image: ${url}`);
        // Continue with other images
      }
    }
  }
  
  return results;
}

/**
 * Converts multiple image URLs to clean base64 (without prefix)
 */
export async function convertImagesToCleanBase64(urls: string[]): Promise<Array<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }>> {
  const results: Array<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> = [];
  
  for (const url of urls) {
    if (url && url.startsWith('http')) {
      try {
        const result = await imageUrlToCleanBase64(url);
        results.push(result);
      } catch (error) {
        console.error(`[IMAGE] Skipping failed image: ${url}`);
      }
    }
  }
  
  return results;
}

// --- Gemini 3 Pro (Analysis - Async Job Based) ---

/**
 * Creates an async Gemini task using KIE.ai jobs system
 * Returns taskId immediately, result is fetched via polling
 */
export async function createGeminiTask(messages: GeminiMessage[]): Promise<string> {
  try {
    const requestBody = {
      model: 'gemini-3-pro',
      input: {
        messages,
        stream: false,
      },
    };
    
    console.log('[GEMINI] Creating async task...');
    
    const response = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Task Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(`Gemini Task Error: ${data.msg}`);
    }
    
    console.log('[GEMINI] Task created:', data.data.taskId);
    return data.data.taskId;
  } catch (error) {
    console.error('Error creating Gemini task:', error);
    throw error;
  }
}

/**
 * Gets Gemini task result - extracts the text response
 */
export async function getGeminiTaskResult(taskId: string): Promise<KieTaskResult & { text?: string }> {
  const result = await getKieTaskResult(taskId);
  
  if (result.status === 'SUCCESS' && result.result) {
    // Extract text from Gemini response
    let text = '';
    
    if (typeof result.result === 'string') {
      text = result.result;
    } else if (result.result.choices?.[0]?.message?.content) {
      text = result.result.choices[0].message.content;
    } else if (result.result.response) {
      text = result.result.response;
    } else if (result.result.content) {
      text = result.result.content;
    } else if (result.result.text) {
      text = result.result.text;
    }
    
    return { ...result, text };
  }
  
  return result;
}

// --- Claude Sonnet 4.5 (Multimodal Analysis - Sync) ---

export interface ClaudeOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Analyzes content with Claude Sonnet 4.5 (supports images + text)
 * This is the recommended model for multimodal analysis in Kie.ai
 * 
 * For images, use format:
 * { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }
 */
export async function analyzeWithClaudeSonnet(
  messages: GeminiMessage[],
  options: ClaudeOptions = {}
) {
  try {
    const {
      temperature = 0.7,
      maxTokens = 8000,
      model = 'claude-sonnet-4-5-20250929'
    } = options;

    const requestBody = {
      model,
      messages,
      stream: false,
      temperature,
      max_tokens: maxTokens,
    };
    
    const endpoint = `${KIE_BASE_URL}/claude-sonnet-4-5/v1/chat/completions`;
    console.log(`[CLAUDE] Sending request to endpoint: ${endpoint}`);
    console.log(`[CLAUDE] Model: ${model}, Temperature: ${temperature}, MaxTokens: ${maxTokens}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log('[CLAUDE] Response structure:', JSON.stringify(data).substring(0, 500));
    
    // Extract text from Claude response (OpenAI-compatible format)
    if (data.choices && data.choices[0]?.message?.content) {
      console.log('[CLAUDE] Response received successfully');
      return data.choices[0].message.content;
    }
    
    // Check if error response from Kie.ai
    if (data.code || data.msg) {
      throw new Error(`Claude API Error: ${data.msg || data.code}`);
    }
    
    throw new Error(`Unexpected Claude response format: ${JSON.stringify(data).substring(0, 200)}`);
  } catch (error) {
    console.error('Error calling Claude Sonnet 4.5:', error);
    throw error;
  }
}

// --- Gemini 3 Pro (Multimodal Image Analysis - Sync) ---

interface GeminiOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Analyzes images with Gemini 3 Pro (supports multimodal: images + text)
 * Use this for analyzing template images, product images, etc.
 * Gemini 3 Pro has superior image understanding capabilities
 */
export async function analyzeWithGemini3Pro(messages: GeminiMessage[], options: GeminiOptions = {}) {
  try {
    const { temperature = 0.7, maxTokens = 8000 } = options;
    
    const requestBody = {
      messages,
      stream: false,
      temperature,
      max_tokens: maxTokens,
    };
    
    console.log(`[GEMINI] Sending request to Gemini 3 Pro... (temp: ${temperature}, maxTokens: ${maxTokens})`);
    
    const response = await fetch(`${KIE_BASE_URL}/gemini-3-pro/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0]?.message?.content) {
      console.log('[GEMINI] Response received successfully');
      return data.choices[0].message.content;
    }
    if (data.response) return data.response;
    if (data.content) return data.content;
    if (typeof data === 'string') return data;
    
    throw new Error('Unexpected Gemini response format');
  } catch (error) {
    console.error('Error calling Gemini 3 Pro:', error);
    throw error;
  }
}

// --- Claude Sonnet 4.6 (Anthropic Messages API on kie.ai - Multimodal Analysis) ---
//
// Endpoint: https://api.kie.ai/claude/v1/messages (Anthropic native format)
// Model:    claude-sonnet-4-6
// Vision:   Yes (image content blocks: {type:'image', source:{type:'base64', media_type, data}})
//
// This is the PRIMARY analysis model for the static-ads pipeline.
// Translates from the internal GeminiMessage shape (OpenAI-compatible content blocks)
// into Anthropic's native Messages format so the rest of the codebase doesn't need to know.

interface AnthropicTextBlock { type: 'text'; text: string }
interface AnthropicImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}
type AnthropicContentBlock = AnthropicTextBlock | AnthropicImageBlock;
interface AnthropicMessage { role: 'user' | 'assistant'; content: string | AnthropicContentBlock[] }

/**
 * Translates the internal GeminiMessage shape into Anthropic Messages API format.
 *  - role='developer'|'system' messages collapse into a single top-level `system` string.
 *  - 'image_url' content blocks (data URI) become Anthropic 'image' blocks with parsed base64.
 *  - 'image_url' with HTTP URL is downloaded and converted to base64 inline.
 */
async function toAnthropicMessages(messages: GeminiMessage[]): Promise<{ system: string; messages: AnthropicMessage[] }> {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'developer' || msg.role === 'system') {
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
      if (text) systemParts.push(text);
      continue;
    }

    const role = msg.role === 'assistant' ? 'assistant' : 'user';

    if (typeof msg.content === 'string') {
      out.push({ role, content: msg.content });
      continue;
    }

    const blocks: AnthropicContentBlock[] = [];
    for (const block of msg.content as any[]) {
      if (block.type === 'text') {
        blocks.push({ type: 'text', text: block.text });
      } else if (block.type === 'image_url') {
        const url: string = block.image_url?.url || '';
        if (url.startsWith('data:image/')) {
          const mediaType = getMediaTypeFromDataUri(url);
          const data = stripBase64Prefix(url);
          blocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
        } else if (url.startsWith('http')) {
          const { base64, mediaType } = await imageUrlToCleanBase64(url);
          blocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
        }
      }
    }
    out.push({ role, content: blocks });
  }

  return { system: systemParts.join('\n\n'), messages: out };
}

export interface ClaudeKieOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Analyzes with Claude Sonnet 4.6 (or any Claude exposed via /claude/v1/messages on kie.ai).
 * Use for: template analysis with vision, adaptation reasoning, prompt generation.
 */
export async function analyzeWithClaude46(messages: GeminiMessage[], options: ClaudeKieOptions = {}): Promise<string> {
  const { temperature = 0.5, maxTokens = 8000, model = 'claude-sonnet-4-6' } = options;
  const { system, messages: anthropicMessages } = await toAnthropicMessages(messages);

  const requestBody: Record<string, any> = {
    model,
    messages: anthropicMessages,
    stream: false,
    max_tokens: maxTokens,
    temperature,
  };
  if (system) requestBody.system = system;

  const endpoint = `${KIE_BASE_URL}/claude/v1/messages`;
  console.log(`[CLAUDE-4.6] POST ${endpoint} (model=${model}, temp=${temperature}, maxTokens=${maxTokens})`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude 4.6 API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Anthropic-style response: { content: [{type:'text', text:'...'}, ...] }
  if (Array.isArray(data.content)) {
    const text = data.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    if (text) {
      console.log('[CLAUDE-4.6] Response received successfully');
      return text;
    }
  }

  // Some kie.ai gateways still proxy OpenAI-compat shape. Handle that too.
  if (data.choices?.[0]?.message?.content) {
    return String(data.choices[0].message.content);
  }

  if (data.code || data.msg) {
    throw new Error(`Claude 4.6 API Error: ${data.msg || data.code}`);
  }

  throw new Error(`Unexpected Claude 4.6 response shape: ${JSON.stringify(data).slice(0, 300)}`);
}

/**
 * Unified analysis dispatcher. Routes to the right wrapper based on the model name.
 * The admin can change the active model via the `kie_analysis_model` row in `admin_config`
 * and this function will respect it without any code change.
 *
 * Default: claude-sonnet-4-6 (best quality with native vision).
 * Fallback chain on error is the caller's responsibility — see lib/analysis-runner.
 */
export async function analyzeWithModel(
  modelName: string,
  messages: GeminiMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const m = (modelName || DEFAULT_ANALYSIS_MODEL).toLowerCase();

  if (m.startsWith('claude-sonnet-4-6') || m === 'claude-4-6' || m === 'claude46') {
    return analyzeWithClaude46(messages, { ...options, model: 'claude-sonnet-4-6' });
  }
  if (m.startsWith('claude-sonnet-4-5') || m === 'claude-4-5') {
    return analyzeWithClaudeSonnet(messages, options);
  }
  if (m.startsWith('gemini-3-pro') || m === 'gemini-pro' || m === 'gemini') {
    return analyzeWithGemini3Pro(messages, options);
  }
  if (m.startsWith('gemini-flash')) {
    return analyzeWithGeminiFlash2(messages, { temperature: options.temperature });
  }

  console.warn(`[ANALYZE] Unknown model "${modelName}" — falling back to ${DEFAULT_ANALYSIS_MODEL}`);
  return analyzeWithClaude46(messages, { ...options, model: 'claude-sonnet-4-6' });
}

// --- Gemini Flash 2.0 (Fast Multimodal Analysis - Sync) ---

/**
 * Analyzes images with Gemini Flash 2.0 (fast, supports multimodal)
 * Recommended for template analysis where speed is important
 */
export async function analyzeWithGeminiFlash2(messages: GeminiMessage[], options?: { temperature?: number }) {
  try {
    const requestBody = {
      messages,
      stream: false,
      temperature: options?.temperature ?? 0.4,
    };
    
    console.log('[GEMINI-FLASH] Sending request to Gemini Flash 2.0...');
    
    const response = await fetch(`${KIE_BASE_URL}/gemini-flash-2-0/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Flash API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0]?.message?.content) {
      console.log('[GEMINI-FLASH] Response received successfully');
      return data.choices[0].message.content;
    }
    if (data.response) return data.response;
    if (data.content) return data.content;
    if (typeof data === 'string') return data;
    
    throw new Error('Unexpected Gemini Flash response format');
  } catch (error) {
    console.error('Error calling Gemini Flash 2.0:', error);
    throw error;
  }
}

// --- Nano Banana Pro (Generation - Job Based) ---

export async function createKieTask(model: string, input: NanoBananaInput | any) {
  try {
    // Build the request body according to Kie.ai docs
    const requestBody: any = {
      model, // e.g., 'nano-banana-pro'
      input: {
        prompt: input.prompt,
        // Default settings for high quality static ads
        aspect_ratio: input.aspect_ratio || '1:1',
        resolution: input.resolution || '2K',
        output_format: input.output_format || 'png',
        // Nano Banana Pro specific parameters
        negative_prompt: input.negative_prompt || 'low quality, blurry, distorted, watermark, text, logo',
        num_inference_steps: input.num_inference_steps || 50,
        guidance_scale: input.guidance_scale || 7.5,
      },
    };

    // Add image references if provided (supports both URLs and base64)
    if (input.image_input && Array.isArray(input.image_input) && input.image_input.length > 0) {
      const validImages: string[] = [];
      
      for (const img of input.image_input) {
        if (!img) continue;
        
        // Accept HTTP URLs directly
        if (img.startsWith('http')) {
          validImages.push(img);
        }
        // Accept clean base64 strings (without data: prefix)
        else if (img.length > 100 && !img.includes(' ') && !img.startsWith('data:')) {
          validImages.push(img);
        }
        // Accept data URIs and strip the prefix
        else if (img.startsWith('data:image/')) {
          validImages.push(stripBase64Prefix(img));
        }
        
        // Max 8 images per Kie.ai docs
        if (validImages.length >= 8) break;
      }
      
      if (validImages.length > 0) {
        requestBody.input.image_input = validImages;
        console.log(`[KIE] Including ${validImages.length} reference images`);
        console.log(`[KIE] Image 0 preview: ${validImages[0]?.substring(0, 100)}...`);
      }
    }

    console.log('[KIE] Creating task for model:', model);
    console.log('[KIE] Prompt:', input.prompt?.substring(0, 200) + '...');

    const response = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`KIE API Error: ${text}`);
    }

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(`KIE Task Error: ${data.msg}`);
    }

    console.log('[KIE] Task created:', data.data.taskId);
    return data.data.taskId;
  } catch (error) {
    console.error('Error creating KIE task:', error);
    throw error;
  }
}

export async function getKieTaskResult(taskId: string): Promise<KieTaskResult> {
  try {
    // kie.ai renamed the endpoint from /jobs/getTaskDetail to /jobs/recordInfo
    // and changed the response shape (numeric `status` → string `state`,
    // result moved into `resultJson` as a JSON-encoded string).
    const response = await fetch(`${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get task detail: HTTP ${response.status}`);
    }

    const data = await response.json();
    const rec = data?.data;
    if (!rec) {
      return { taskId, status: 'FAILED', error: data?.msg || 'Empty response from kie.ai' };
    }

    const stateRaw = String(rec.state ?? rec.status ?? '').toLowerCase();
    let status: KieTaskResult['status'] = 'PROCESSING';
    if (stateRaw === 'success' || stateRaw === 'completed') status = 'SUCCESS';
    else if (stateRaw === 'fail' || stateRaw === 'failed' || stateRaw === 'error') status = 'FAILED';
    else if (stateRaw === 'waiting' || stateRaw === 'queue' || stateRaw === 'queued' || stateRaw === 'pending') status = 'PENDING';

    let result: any = undefined;
    if (status === 'SUCCESS') {
      // resultJson is a JSON-encoded string, e.g. {"resultUrls":["https://..."]}
      const raw = rec.resultJson || rec.result;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          result = parsed.resultUrls || parsed.result_urls || parsed.urls || parsed.output || parsed.result || parsed;
        } catch {
          result = raw;
        }
      } else if (raw) {
        result = raw;
      }
    }

    return {
      taskId,
      status,
      result,
      error: status === 'FAILED' ? (rec.failMsg || rec.failCode || data?.msg || 'kie.ai task failed') : undefined,
    };

  } catch (error) {
    console.error('Error getting KIE task result:', error);
    return { taskId, status: 'FAILED', error: String(error) };
  }
}

/**
 * Polls a KIE task until it completes or fails
 * @param taskId - The task ID to poll
 * @param options - Polling options
 * @returns The final task result
 */
export async function pollKieTaskUntilComplete(
  taskId: string,
  options: PollOptions = {}
): Promise<KieTaskResult> {
  const {
    intervalMs = 5000,
    maxAttempts = 60, // 5 minutes max with 5s interval
    onProgress
  } = options;

  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    
    const result = await getKieTaskResult(taskId);
    
    if (onProgress) {
      onProgress(result.status, attempts);
    }

    if (result.status === 'SUCCESS') {
      console.log(`[POLL] Task ${taskId} completed after ${attempts} attempts`);
      return result;
    }

    if (result.status === 'FAILED') {
      console.error(`[POLL] Task ${taskId} failed:`, result.error);
      return result;
    }

    // Still processing, wait and try again
    console.log(`[POLL] Task ${taskId} status: ${result.status} (attempt ${attempts}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  // Timeout
  console.error(`[POLL] Task ${taskId} timed out after ${maxAttempts} attempts`);
  return {
    taskId,
    status: 'FAILED',
    error: `Polling timed out after ${maxAttempts * intervalMs / 1000} seconds`
  };
}

/**
 * Downloads an image from a URL and returns it as a Buffer.
 * Same SSRF allowlist as imageUrlToBase64 — never fetch arbitrary hosts.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const safeUrl = assertHostAllowed(url);
  console.log(`[DOWNLOAD] Fetching: ${safeUrl.host}${safeUrl.pathname.substring(0, 30)}...`);

  const response = await fetch(safeUrl.toString(), {
    headers: { 'Accept': 'image/*,video/*' }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  console.log(`[DOWNLOAD] Downloaded ${Math.round(arrayBuffer.byteLength / 1024)}KB`);
  
  return Buffer.from(arrayBuffer);
}

// --- Helpers ---

export async function getKieModelConfig() {
  const supabase = await createClient();
  
  const { data: analysisConfig } = await supabase
    .from('admin_config')
    .select('value')
    .eq('key', 'kie_analysis_model')
    .single();
    
  const { data: genConfig } = await supabase
    .from('admin_config')
    .select('value')
    .eq('key', 'kie_generation_model')
    .single();

  return {
    // Claude Sonnet 4.6 is the recommended model for multimodal analysis (images + text)
    // on kie.ai as of 2025. Falls back to whatever the admin configured if set.
    analysisModel: analysisConfig?.value || DEFAULT_ANALYSIS_MODEL,
    generationModel: genConfig?.value || DEFAULT_GENERATION_MODEL,
  };
}

/**
 * Runs an analysis call with automatic fallback.
 * Tries the primary model (default: Claude Sonnet 4.6). If it fails — most likely cause is
 * Claude vision not being available on kie.ai — falls back to Gemini 3 Pro, which we know
 * handles multimodal reliably. Logs which model actually produced the result.
 *
 * The fallback model is also configurable via admin_config.kie_analysis_fallback_model.
 */
export async function analyzeWithFallback(
  primaryModel: string,
  messages: GeminiMessage[],
  options: { temperature?: number; maxTokens?: number; fallbackModel?: string } = {}
): Promise<{ text: string; modelUsed: string; fellBack: boolean }> {
  const fallback = options.fallbackModel || 'gemini-3-pro';
  try {
    const text = await analyzeWithModel(primaryModel, messages, options);
    return { text, modelUsed: primaryModel, fellBack: false };
  } catch (primaryError: any) {
    console.error(`[ANALYZE] Primary model "${primaryModel}" failed: ${primaryError.message}`);
    if (primaryModel === fallback) throw primaryError;
    console.warn(`[ANALYZE] Falling back to "${fallback}"...`);
    const text = await analyzeWithModel(fallback, messages, options);
    return { text, modelUsed: fallback, fellBack: true };
  }
}
