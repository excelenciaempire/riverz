import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { GeminiProvider } from '@/lib/ai-providers/gemini-provider';
import { encryptApiKey, last4 } from '@/lib/ai-providers/key-vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 20) {
      return NextResponse.json({ error: 'API key inválida' }, { status: 400 });
    }
    const trimmed = apiKey.trim();

    const provider = new GeminiProvider(trimmed);
    const ping = await provider.ping();
    if (!ping.ok) {
      return NextResponse.json(
        { ok: false, error: ping.error.userMessage, code: ping.error.code },
        { status: 400 },
      );
    }

    const encrypted = encryptApiKey(trimmed);
    const tail = last4(trimmed);
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('user_credits')
      .update({
        gemini_api_key_encrypted: encrypted.toString('base64'),
        gemini_api_key_last4: tail,
        gemini_api_key_validated_at: now,
        updated_at: now,
      })
      .eq('clerk_user_id', userId);

    if (error) {
      console.error('[GEMINI-KEY] persist failed:', error);
      return NextResponse.json({ error: 'No se pudo guardar la API key' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, last4: tail, validated_at: now });
  } catch (error: any) {
    console.error('[GEMINI-KEY] POST error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabaseAdmin
      .from('user_credits')
      .update({
        gemini_api_key_encrypted: null,
        gemini_api_key_last4: null,
        gemini_api_key_validated_at: null,
        ai_provider_primary: 'kie',
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId);

    if (error) {
      console.error('[GEMINI-KEY] delete failed:', error);
      return NextResponse.json({ error: 'No se pudo eliminar la API key' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[GEMINI-KEY] DELETE error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
