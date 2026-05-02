import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Usar admin client con service role key
    const supabaseAdmin = createAdminClient();

    // Consultar user_credits. Whitelisted columns only — never return the
    // encrypted Gemini key blob to the client. last4 + validated_at are safe
    // to expose so the UI can render "✓ Validada · termina en …AbCd".
    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .select('id, clerk_user_id, email, full_name, plan_type, credits, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_start_date, subscription_end_date, is_active, created_at, updated_at, gemini_api_key_last4, gemini_api_key_validated_at, ai_provider_primary, ai_provider_fallback_enabled')
      .eq('clerk_user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user credits:', error);

      // Si el usuario no existe en user_credits, retornar valores por defecto
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          clerk_user_id: userId,
          plan_type: 'free',
          credits: 0,
          subscription_status: 'inactive',
          ai_provider_primary: 'kie',
          ai_provider_fallback_enabled: true,
          gemini_api_key_last4: null,
          gemini_api_key_validated_at: null,
        });
      }

      throw error;
    }

    return NextResponse.json({
      ...data,
      has_gemini_key: !!data.gemini_api_key_validated_at,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Whitelist editable fields. Anything sensitive (credits, plan_type, the
    // Gemini key blob, provider preference) goes through dedicated endpoints
    // — never via the catch-all PATCH, otherwise a malicious client could
    // wipe their encrypted key or self-promote their plan.
    const ALLOWED: Record<string, true> = {
      language: true,
      full_name: true,
    };
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(body || {})) {
      if (ALLOWED[k]) updates[k] = v;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields in body' }, { status: 400 });
    }

    // Usar admin client con service role key
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .update(updates)
      .eq('clerk_user_id', userId)
      .select('id, clerk_user_id, email, full_name, plan_type, credits, subscription_status, ai_provider_primary, ai_provider_fallback_enabled, gemini_api_key_last4, gemini_api_key_validated_at')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

