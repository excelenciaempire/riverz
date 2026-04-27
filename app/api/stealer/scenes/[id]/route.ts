import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Params {
  params: { id: string };
}

const ALLOWED_FIELDS = ['start_sec', 'end_sec', 'type', 'audio_text'] as const;
const ALLOWED_TYPES = new Set(['actor', 'broll']);

/**
 * PATCH /api/stealer/scenes/[id]
 * Body: { start_sec?, end_sec?, type?, audio_text? }
 *
 * Used by the timeline editor to adjust scene boundaries and to label each
 * scene as 'actor' or 'broll' before kicking off generation.
 *
 * Only allowed while the parent project is in 'awaiting_user_review' or
 * 'scenes_ready' — once generation starts the scenes are locked.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const sceneId = params.id;
    const body = await req.json();

    const updates: Record<string, any> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) updates[field] = body[field];
    }

    if (updates.type && !ALLOWED_TYPES.has(updates.type)) {
      return NextResponse.json({ error: 'type must be actor or broll' }, { status: 400 });
    }
    if (
      typeof updates.start_sec === 'number' &&
      typeof updates.end_sec === 'number' &&
      updates.start_sec >= updates.end_sec
    ) {
      return NextResponse.json({ error: 'start_sec must be < end_sec' }, { status: 400 });
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no editable fields in body' }, { status: 400 });
    }

    // Make sure the scene belongs to this user and the project is editable.
    const { data: scene, error: fetchErr } = await supabaseAdmin
      .from('stealer_scenes')
      .select('id, project_id, stealer_projects!inner(clerk_user_id, status)')
      .eq('id', sceneId)
      .single();

    if (fetchErr || !scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const project = (scene as any).stealer_projects;
    if (project.clerk_user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['awaiting_user_review', 'scenes_ready'].includes(project.status)) {
      return NextResponse.json(
        { error: `Cannot edit scenes while project status is "${project.status}"` },
        { status: 409 }
      );
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('stealer_scenes')
      .update(updates)
      .eq('id', sceneId)
      .select('*')
      .single();

    if (updErr) {
      console.error('[stealer/scenes] update failed:', updErr);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, scene: updated });
  } catch (error: any) {
    console.error('[stealer/scenes] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/stealer/scenes/[id]
 * Removes a scene. Same status restriction as PATCH.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const { data: scene, error: fetchErr } = await supabaseAdmin
      .from('stealer_scenes')
      .select('id, project_id, stealer_projects!inner(clerk_user_id, status)')
      .eq('id', params.id)
      .single();

    if (fetchErr || !scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });

    const project = (scene as any).stealer_projects;
    if (project.clerk_user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!['awaiting_user_review', 'scenes_ready'].includes(project.status)) {
      return NextResponse.json(
        { error: `Cannot delete scenes while project status is "${project.status}"` },
        { status: 409 }
      );
    }

    const { error: delErr } = await supabaseAdmin
      .from('stealer_scenes')
      .delete()
      .eq('id', params.id);
    if (delErr) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[stealer/scenes DELETE] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
