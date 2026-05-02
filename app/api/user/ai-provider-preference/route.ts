import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

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

    const { primary, fallback_enabled } = await req.json();

    if (primary !== 'kie' && primary !== 'gemini') {
      return NextResponse.json({ error: 'primary debe ser "kie" o "gemini"' }, { status: 400 });
    }
    if (typeof fallback_enabled !== 'boolean') {
      return NextResponse.json({ error: 'fallback_enabled debe ser boolean' }, { status: 400 });
    }

    if (primary === 'gemini') {
      const { data } = await supabaseAdmin
        .from('user_credits')
        .select('gemini_api_key_validated_at')
        .eq('clerk_user_id', userId)
        .single();
      if (!data?.gemini_api_key_validated_at) {
        return NextResponse.json(
          { error: 'Conecta y valida una API key de Gemini antes de elegirla como canal principal' },
          { status: 400 },
        );
      }
    }

    const { error } = await supabaseAdmin
      .from('user_credits')
      .update({
        ai_provider_primary: primary,
        ai_provider_fallback_enabled: fallback_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId);

    if (error) {
      console.error('[AI-PROVIDER-PREF] update failed:', error);
      return NextResponse.json({ error: 'No se pudo guardar la preferencia' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, primary, fallback_enabled });
  } catch (error: any) {
    console.error('[AI-PROVIDER-PREF] error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
