import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}
