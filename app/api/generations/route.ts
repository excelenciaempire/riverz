import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/meta-route-helpers';
import type { Generation } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/generations?filter=all|videos|images&limit=100
 *
 * Returns the current user's completed generations. Backed by the service
 * role so it works regardless of client-side RLS / Clerk-Supabase JWT
 * plumbing — useful for components like AssetPickerModal that historically
 * couldn't read the table directly.
 */

const VIDEO_TYPES = ['ugc', 'face_swap', 'clips', 'mejorar_calidad_video'];
const IMAGE_TYPES = [
  'editar_foto_crear',
  'editar_foto_editar',
  'editar_foto_combinar',
  'editar_foto_clonar',
  'mejorar_calidad_imagen',
  'static_ad_generation',
];

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') ?? 'all';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);

  let q = supabaseAdmin
    .from('generations')
    .select('*')
    .eq('clerk_user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter === 'videos') q = q.in('type', VIDEO_TYPES);
  else if (filter === 'images') q = q.in('type', IMAGE_TYPES);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ generations: (data ?? []) as Generation[] });
}
