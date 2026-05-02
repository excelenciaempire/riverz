import { createClient } from '@supabase/supabase-js';
import { decryptApiKey } from './key-vault';
import { GeminiProvider } from './gemini-provider';
import { AdsImageProvider, ProviderName, ProviderError } from './types';

export interface UserAiSettings {
  ai_provider_primary: ProviderName;
  ai_provider_fallback_enabled: boolean;
  has_gemini_key: boolean;
  gemini_api_key_last4: string | null;
  gemini_api_key_validated_at: string | null;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function getUserAiSettings(clerkUserId: string): Promise<UserAiSettings> {
  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('ai_provider_primary, ai_provider_fallback_enabled, gemini_api_key_last4, gemini_api_key_validated_at, gemini_api_key_encrypted')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!data) {
    return {
      ai_provider_primary: 'kie',
      ai_provider_fallback_enabled: true,
      has_gemini_key: false,
      gemini_api_key_last4: null,
      gemini_api_key_validated_at: null,
    };
  }
  return {
    ai_provider_primary: (data.ai_provider_primary as ProviderName) || 'kie',
    ai_provider_fallback_enabled: data.ai_provider_fallback_enabled ?? true,
    has_gemini_key: !!data.gemini_api_key_encrypted && !!data.gemini_api_key_validated_at,
    gemini_api_key_last4: data.gemini_api_key_last4 || null,
    gemini_api_key_validated_at: data.gemini_api_key_validated_at || null,
  };
}

export async function getDecryptedGeminiKey(clerkUserId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('gemini_api_key_encrypted')
    .eq('clerk_user_id', clerkUserId)
    .single();
  const blob = data?.gemini_api_key_encrypted;
  if (!blob) return null;
  try {
    return decryptApiKey(blob as any);
  } catch (err: any) {
    console.error('[AI-PROVIDERS] failed to decrypt Gemini key for user', clerkUserId, err?.message);
    return null;
  }
}

export interface ResolvedProvider {
  name: ProviderName;
  geminiProvider?: GeminiProvider;
}

/**
 * Returns the ordered list of providers to try for a given user.
 * The kie path is represented by name='kie' only — it is NOT an AdsImageProvider
 * instance because the kie pipeline already lives in the existing static-ads
 * routes and we don't want to wrap or modify it. Callers branch on `name`.
 */
export async function resolveStaticAdProviders(clerkUserId: string): Promise<ResolvedProvider[]> {
  const settings = await getUserAiSettings(clerkUserId);

  const kie: ResolvedProvider = { name: 'kie' };
  let gemini: ResolvedProvider | null = null;

  if (settings.has_gemini_key) {
    const key = await getDecryptedGeminiKey(clerkUserId);
    if (key) gemini = { name: 'gemini', geminiProvider: new GeminiProvider(key) };
  }

  const primary = settings.ai_provider_primary === 'gemini' && gemini ? gemini : kie;
  const other = primary.name === 'kie' ? gemini : kie;

  if (settings.ai_provider_fallback_enabled && other) {
    return [primary, other];
  }
  return [primary];
}

export function isAuthError(err: any): boolean {
  return err instanceof ProviderError && err.code === 'auth';
}
