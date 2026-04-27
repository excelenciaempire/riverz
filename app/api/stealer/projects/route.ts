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
 * GET /api/stealer/projects
 * Lightweight list for the dashboard landing page (id, name, status, dates).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('stealer_projects')
      .select('id, name, status, source_duration_sec, created_at, updated_at')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[stealer/projects] list failed:', error);
      return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
    }

    return NextResponse.json({ projects: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
