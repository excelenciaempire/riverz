import { supabase } from './supabase.js';

/**
 * Reads an AI prompt from the `ai_prompts` table by key.
 * The Next.js admin panel writes to this same table, so the worker stays in
 * sync with whatever the user edits — no rebuild required.
 */
export async function getPromptText(key: string): Promise<string> {
  const sb = supabase();
  const { data, error } = await sb
    .from('ai_prompts')
    .select('prompt_text')
    .eq('key', key)
    .eq('is_active', true)
    .single();
  if (error || !data?.prompt_text) {
    throw new Error(`Prompt "${key}" not found in ai_prompts (is_active=true). ${error?.message || ''}`);
  }
  return data.prompt_text as string;
}

/** Same as getPromptText but injects {VARIABLE} placeholders. */
export async function getPromptWithVariables(
  key: string,
  variables: Record<string, string | number | undefined>
): Promise<string> {
  let template = await getPromptText(key);
  for (const [k, v] of Object.entries(variables)) {
    template = template.split(`{${k}}`).join(v == null ? '' : String(v));
  }
  return template;
}
