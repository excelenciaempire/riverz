import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin-emails';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function requireAdmin() {
  const { userId } = await auth();
  const user = await currentUser();
  if (!userId || !user) return { error: 'Unauthorized', status: 401 } as const;
  const email = user.emailAddresses[0]?.emailAddress;
  if (!isAdminEmail(email)) return { error: 'Forbidden', status: 403 } as const;
  return { ok: true } as const;
}

export async function GET() {
  const guard = await requireAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { data, error } = await supabaseAdmin
    .from('kie_model_pricing')
    .select('*')
    .order('task_mode', { ascending: true })
    .order('is_default', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pricing: data || [] });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const { task_mode, model_name, model_label, usd_cost, is_default, notes } = body;

  if (!task_mode || !model_name || !model_label || usd_cost === undefined) {
    return NextResponse.json(
      { error: 'task_mode, model_name, model_label y usd_cost son obligatorios' },
      { status: 400 }
    );
  }
  const cost = Number(usd_cost);
  if (!Number.isFinite(cost) || cost < 0) {
    return NextResponse.json({ error: 'usd_cost debe ser >= 0' }, { status: 400 });
  }

  if (is_default === true) {
    await supabaseAdmin
      .from('kie_model_pricing')
      .update({ is_default: false })
      .eq('task_mode', task_mode);
  }

  const { data, error } = await supabaseAdmin
    .from('kie_model_pricing')
    .insert({
      task_mode,
      model_name,
      model_label,
      usd_cost: cost,
      is_default: !!is_default,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, row: data });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.usd_cost !== undefined) {
    const cost = Number(body.usd_cost);
    if (!Number.isFinite(cost) || cost < 0) {
      return NextResponse.json({ error: 'usd_cost debe ser >= 0' }, { status: 400 });
    }
    updates.usd_cost = cost;
  }
  if (body.model_label !== undefined) updates.model_label = String(body.model_label);
  if (body.notes !== undefined) updates.notes = body.notes || null;
  if (body.is_active !== undefined) updates.is_active = !!body.is_active;

  if (body.is_default === true) {
    const { data: existing } = await supabaseAdmin
      .from('kie_model_pricing')
      .select('task_mode')
      .eq('id', id)
      .single();
    if (existing?.task_mode) {
      await supabaseAdmin
        .from('kie_model_pricing')
        .update({ is_default: false })
        .eq('task_mode', existing.task_mode);
    }
    updates.is_default = true;
  } else if (body.is_default === false) {
    updates.is_default = false;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('kie_model_pricing')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, row: data });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('kie_model_pricing')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
