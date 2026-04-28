import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ACTIVE_STATUSES = ['pending_generation', 'generating'];
const MAX_PROJECTS_PER_TICK = 8;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('generations')
    .select('project_id, updated_at')
    .eq('type', 'ugc_video')
    .in('status', ACTIVE_STATUSES)
    .order('updated_at', { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const projects: string[] = [];
  for (const r of rows || []) {
    if (!r.project_id || seen.has(r.project_id)) continue;
    seen.add(r.project_id);
    projects.push(r.project_id);
    if (projects.length >= MAX_PROJECTS_PER_TICK) break;
  }
  if (projects.length === 0) return NextResponse.json({ drained: 0, projects: [] });

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const results: Array<{ projectId: string; ok: boolean; error?: string }> = [];

  for (const projectId of projects) {
    try {
      const res = await fetch(`${origin}/api/ugc/process-queue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${expected}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });
      results.push({ projectId, ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` });
    } catch (err: any) {
      results.push({ projectId, ok: false, error: err?.message || 'fetch failed' });
    }
  }

  return NextResponse.json({ drained: results.length, results });
}
