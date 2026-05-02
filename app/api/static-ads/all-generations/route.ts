import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Flat view of every static-ad generation for the logged-in user, across
 * all projects. Backs the "ver sin carpetas" toggle in /historial — when
 * the user flips that switch we replace the project-folder grid with this
 * tile-per-image layout.
 *
 * Why a dedicated endpoint and not /api/projects + per-project fetch?
 * That would be N+1 round trips (1 list + N gens) for users with dozens
 * of projects, and the historial polls every few seconds. One query that
 * filters at the DB layer keeps the network cost flat.
 *
 * Returns rows ordered newest-first with just the fields the historial UI
 * needs to render a tile + know where to navigate when clicked.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('generations')
    .select('id, status, result_url, project_id, input_data, error_message, updated_at, created_at')
    .eq('clerk_user_id', userId)
    .eq('type', 'static_ad_generation')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[ALL_GENERATIONS]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generations: data || [] });
}
