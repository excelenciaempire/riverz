/**
 * Editor V2 — entrada server-side. Carga la página desde Supabase y la
 * pasa al componente cliente Editor. Si el id no existe o no pertenece al
 * user, redirige al dashboard.
 *
 * Esta es la nueva ruta que reemplaza /landing-lab/edit?p=...
 * (ese sigue funcionando para los proyectos legacy en localStorage).
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { Editor } from './Editor';
import type { LandingPage } from '@/types/landing-pages';

export const dynamic = 'force-dynamic';

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, name, kind, status, document, product_id, thumbnail_url, created_at, updated_at, clerk_user_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !data || data.clerk_user_id !== userId) {
    redirect('/landing-lab');
  }

  return <Editor initialPage={data as LandingPage} />;
}
