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

/**
 * POST /api/stealer/projects/[id]/start
 *
 * User has reviewed the auto-detected scenes and labeled each as actor/broll.
 * This endpoint locks the timeline and enqueues the per-scene jobs the worker
 * needs to actually generate the new clips.
 *
 * Phase 1 only enqueues `generate_prompts` — the worker (in later phases) will
 * fan-out to `tts_master` and per-scene `generate_actor` / `generate_broll`
 * once the prompts and audio segments are ready.
 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const projectId = params.id;

    const { data: project, error: pErr } = await supabaseAdmin
      .from('stealer_projects')
      .select('id, status, transcript')
      .eq('id', projectId)
      .eq('clerk_user_id', userId)
      .single();
    if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    if (project.status !== 'awaiting_user_review') {
      return NextResponse.json(
        { error: `Project is in status "${project.status}", cannot start` },
        { status: 409 }
      );
    }

    if (!project.transcript) {
      return NextResponse.json({ error: 'Transcript is missing' }, { status: 409 });
    }

    const { data: scenes, error: sErr } = await supabaseAdmin
      .from('stealer_scenes')
      .select('id, type')
      .eq('project_id', projectId);
    if (sErr || !scenes || scenes.length === 0) {
      return NextResponse.json({ error: 'No scenes to process' }, { status: 409 });
    }

    // Flip status first so PATCH/DELETE on scenes is rejected from now on.
    const { error: updErr } = await supabaseAdmin
      .from('stealer_projects')
      .update({ status: 'processing' })
      .eq('id', projectId);
    if (updErr) return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });

    // Per-scene prompt generation runs in parallel with TTS.
    const promptJobs = scenes.map((s) => ({
      project_id: projectId,
      scene_id: s.id,
      kind: 'generate_prompts',
    }));
    await supabaseAdmin.from('stealer_jobs').insert(promptJobs);

    // tts_master is the entry point for the audio chain. The handler decides
    // whether to actually call ElevenLabs (if a voice is configured + API key
    // present) or to skip TTS and reuse the original audio. Either way it
    // enqueues a follow-up `split_audio` once the master audio is ready.
    await supabaseAdmin.from('stealer_jobs').insert({
      project_id: projectId,
      kind: 'tts_master',
    });

    return NextResponse.json({
      success: true,
      projectId,
      scenesQueued: scenes.length,
    });
  } catch (error: any) {
    console.error('[stealer/start] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
