import { createClient } from '@/lib/supabase/server';

const KIE_API_KEY = '174d2ff19987520a25ecd1ed9c3ccc2b';
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

// --- Gemini 3 Pro (Analysis) ---

export async function analyzeWithGemini3Pro(messages: GeminiMessage[]) {
  try {
    const response = await fetch(`${KIE_BASE_URL}/gemini-3-pro/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3-pro',
        messages,
        stream: false, // We want the full response for now
        response_format: {
             type: "object",
             properties: {
                 response: { type: "string" }
             }
        } // Optional: Enforce JSON if we want structured output, but simple text is fine for prompts.
          // User docs show response_format example. Let's stick to standard text for creativity unless we need strict JSON.
          // Actually, prompt generation is better as free text.
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // OpenAI format response
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error calling Gemini 3 Pro:', error);
    throw error;
  }
}

// --- Nano Banana Pro (Generation - Job Based) ---

export async function createKieTask(model: string, input: any) {
  try {
    const response = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model, // e.g., 'nano-banana-pro'
        input,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`KIE API Error: ${text}`);
    }

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(`KIE Task Error: ${data.msg}`);
    }

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
    // 0: Queue, 1: Processing, 2: Success, 3: Failed (Assumption, need verification or defensive coding)
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

// --- Helpers ---

export async function getKieModelConfig() {
  const supabase = await createClient();
  
  const { data: genConfig } = await supabase
    .from('admin_config')
    .select('value')
    .eq('key', 'kie_generation_model')
    .single();

  return {
    // We enforce Gemini 3 Pro for analysis as per user request
    analysisModel: 'gemini-3-pro', 
    generationModel: genConfig?.value || 'nano-banana-pro'
  };
}
