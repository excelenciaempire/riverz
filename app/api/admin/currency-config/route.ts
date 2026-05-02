import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin-emails';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const KEYS = ['display_currency_mode', 'credit_usd_rate'] as const;
const VALID_MODES = new Set(['credits', 'usd']);

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
    .from('admin_config')
    .select('key, value')
    .in('key', KEYS as unknown as string[]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const map: Record<string, string> = {};
  for (const row of data || []) map[row.key] = row.value;

  const mode = VALID_MODES.has(map.display_currency_mode)
    ? (map.display_currency_mode as 'credits' | 'usd')
    : 'credits';
  const rate = Number(map.credit_usd_rate);
  const creditUsdRate = Number.isFinite(rate) && rate > 0 ? rate : 0.01;

  return NextResponse.json({ mode, creditUsdRate });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Array<{ key: string; value: string }> = [];

  if (body.mode !== undefined) {
    if (!VALID_MODES.has(body.mode)) {
      return NextResponse.json(
        { error: 'mode debe ser "credits" o "usd"' },
        { status: 400 }
      );
    }
    updates.push({ key: 'display_currency_mode', value: body.mode });
  }

  if (body.creditUsdRate !== undefined) {
    const rate = Number(body.creditUsdRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: 'creditUsdRate debe ser un número positivo' },
        { status: 400 }
      );
    }
    updates.push({ key: 'credit_usd_rate', value: String(rate) });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  for (const u of updates) {
    const { error } = await supabaseAdmin
      .from('admin_config')
      .upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
