/**
 * Landing Pages V2 — list + create.
 *
 * - GET  /api/landing-pages              → lista del usuario actual
 * - POST /api/landing-pages              → crea una nueva (vacía o desde un template)
 *
 * El editor v2 hace POST aquí desde el Home composer; luego navega a
 * /landing-lab/edit/{id} con el id devuelto.
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { EMPTY_DOCUMENT, type LandingPageKind, type PageDocument } from '@/types/landing-pages';
import { getSection } from '@/lib/sections/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateBody {
  name?: string;
  kind?: LandingPageKind;
  product_id?: string | null;
  /**
   * Lista opcional de tipos de sección a pre-cargar (e.g.
   * ["hero-01","benefits-01","testimonials-01","faqs-01"]). Si vacío, la
   * página arranca sin secciones — el usuario las añade desde el sidebar.
   */
  preset_sections?: string[];
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function buildPreset(types: string[]): PageDocument {
  const sections = types
    .map((type) => {
      const def = getSection(type);
      if (!def) return null;
      return {
        id: newId(),
        type,
        visible: { ...(def.defaultVisible ?? {}) },
        props: { ...def.defaultProps },
      };
    })
    .filter(Boolean) as PageDocument['sections'];
  return { sections, theme: {}, meta: {} };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, name, kind, status, thumbnail_url, updated_at, created_at')
    .eq('clerk_user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pages: data ?? [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    /* allow empty body */
  }

  const document =
    body.preset_sections && body.preset_sections.length
      ? buildPreset(body.preset_sections)
      : EMPTY_DOCUMENT;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .insert({
      clerk_user_id: userId,
      name: body.name?.trim() || 'Untitled landing',
      kind: body.kind ?? 'landing_page',
      product_id: body.product_id ?? null,
      document,
      status: 'draft',
    })
    .select('id, name, kind, status, document, product_id, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ page: data });
}
