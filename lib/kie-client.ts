import { createClient } from '@/lib/supabase/server';

// Use environment variable for API key (fallback for backwards compatibility)
const KIE_API_KEY = process.env.KIE_API_KEY || '174d2ff19987520a25ecd1ed9c3ccc2b';
const KIE_BASE_URL = 'https://api.kie.ai';

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
 * Downloads an image from URL and converts it to base64 data URI
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    console.log(`[IMAGE] Converting to base64: ${url.substring(0, 60)}...`);
    
    const response = await fetch(url, {
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
    
    // Extract text from Claude response (OpenAI-compatible format)
    if (data.choices && data.choices[0]?.message?.content) {
      console.log('[CLAUDE] Response received successfully');
      return data.choices[0].message.content;
    }
    
    throw new Error('Unexpected Claude response format');
  } catch (error) {
    console.error('Error calling Claude Sonnet 4.5:', error);
    throw error;
  }
}

// --- Gemini 3 Pro (Multimodal Image Analysis - Sync) ---

/**
 * Analyzes images with Gemini 3 Pro (supports multimodal: images + text)
 * Use this for analyzing template images, product images, etc.
 * Gemini 3 Pro has superior image understanding capabilities
 */
export async function analyzeWithGemini3Pro(messages: GeminiMessage[]) {
  try {
    const requestBody = {
      messages,
      stream: false,
    };
    
    console.log('[GEMINI] Sending request to Gemini 3 Pro...');
    
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
    const response = await fetch(`${KIE_BASE_URL}/api/v1/jobs/getTaskDetail?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get task detail');
    }

    const data = await response.json();
    
    // Status mapping based on KIE
    // 0: Queue, 1: Processing, 2: Success, 3: Failed
    const statusMap: Record<number, KieTaskResult['status']> = {
      0: 'PENDING',
      1: 'PROCESSING',
      2: 'SUCCESS',
      3: 'FAILED',
      4: 'FAILED'
    };
    
    const status = statusMap[data.data?.status] || 'PROCESSING';
    
    return {
      taskId,
      status,
      result: data.data?.result,
      error: data.msg !== 'success' ? data.msg : undefined
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
 * Downloads an image from a URL and returns it as a Buffer
 */
export async function downloadImage(url: string): Promise<Buffer> {
  console.log(`[DOWNLOAD] Fetching image: ${url.substring(0, 60)}...`);
  
  const response = await fetch(url, {
    headers: { 'Accept': 'image/*' }
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
    // Claude Sonnet 4.5 is recommended for multimodal analysis (images + text)
    analysisModel: analysisConfig?.value || 'claude-sonnet-4-5',
    generationModel: genConfig?.value || 'nano-banana-pro'
  };
}
