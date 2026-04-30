import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface UpdateBody {
  default_ad_account_id?: string | null;
  default_page_id?: string | null;
  default_page_name?: string | null;
  default_instagram_id?: string | null;
  default_instagram_username?: string | null;
}

const ALLOWED_FIELDS: Array<keyof UpdateBody> = [
  'default_ad_account_id',
  'default_page_id',
  'default_page_name',
  'default_instagram_id',
  'default_instagram_username',
];

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: UpdateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const update: Record<string, string | null> = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in body) update[k] = (body[k] as string | null) ?? null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('meta_connections')
    .update(update)
    .eq('clerk_user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
