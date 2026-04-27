import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/voices — list active voices.
 * Returns the riverz voice id (UUID) and the friendly fields needed by selectors.
 * The eleven_labs_voice_id is intentionally NOT exposed to the browser; the
 * worker resolves it server-side when generating audio.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('voices')
      .select('id, name, language, gender, accent, age, description, preview_url, use_case')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('[voices] list failed:', error);
      return NextResponse.json({ error: 'Failed to list voices' }, { status: 500 });
    }
    return NextResponse.json({ voices: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
