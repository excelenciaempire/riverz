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
 * GET /api/avatars — list active avatars.
 * Used by the UGC + STEALER pages to populate the avatar selector.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('avatars')
      .select('id, name, image_url')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('[avatars] list failed:', error);
      return NextResponse.json({ error: 'Failed to list avatars' }, { status: 500 });
    }
    return NextResponse.json({ avatars: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
