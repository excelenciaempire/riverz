import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import {
  uploadImageFromUrl,
  uploadVideoFromUrl,
  MetaAuthError,
  MetaApiError,
} from '@/lib/meta-client';
import { resolveConnection } from '@/lib/meta-connection';
import type {
  BulkUploadRequest,
  BulkUploadResponse,
  BulkUploadResponseRow,
  MetaAssetType,
} from '@/types/meta';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VIDEO_TYPES = new Set(['ugc', 'face_swap', 'clips', 'mejorar_calidad_video']);
const MAX_BATCH = 50;
const CONCURRENCY = 3;

function classify(type: string): MetaAssetType {
  return VIDEO_TYPES.has(type) || type.includes('video') ? 'video' : 'image';
}

async function processInChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const results = await Promise.allSettled(slice.map(fn));
    for (const r of results) {
      if (r.status === 'fulfilled') out.push(r.value);
      else out.push(r.reason as R);
    }
  }
  return out;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: BulkUploadRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { generationIds, adAccountId, metadata } = body || {};
  if (!Array.isArray(generationIds) || generationIds.length === 0) {
    return NextResponse.json({ error: 'generationIds es requerido' }, { status: 400 });
  }
  if (generationIds.length > MAX_BATCH) {
    return NextResponse.json({ error: `Máximo ${MAX_BATCH} elementos por subida` }, { status: 400 });
  }
  if (!adAccountId || typeof adAccountId !== 'string') {
    return NextResponse.json({ error: 'adAccountId es requerido' }, { status: 400 });
  }

  const { data: connection, error: connError } = await supabaseAdmin
    .from('meta_connections')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 });
  }

  const resolved = resolveConnection(connection);
  if (!resolved.ok) {
    if (resolved.markExpired) {
      await supabaseAdmin
        .from('meta_connections')
        .update({ status: 'expired', last_error: 'token_expired' })
        .eq('clerk_user_id', userId);
    }
    const errorBody: Record<string, unknown> = { error: resolved.error };
    if (resolved.requiresReconnect) errorBody.requiresReconnect = true;
    return NextResponse.json(errorBody, { status: resolved.status });
  }
  const token = resolved.token;

  const { data: generations, error: genError } = await supabaseAdmin
    .from('generations')
    .select('id, type, result_url, project_id, status, clerk_user_id')
    .in('id', generationIds)
    .eq('clerk_user_id', userId)
    .eq('status', 'completed');

  if (genError) {
    return NextResponse.json({ error: genError.message }, { status: 500 });
  }

  const foundIds = new Set((generations || []).map((g) => g.id));
  const missing = generationIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Algunas generaciones no existen, no son tuyas o no están completadas', missing },
      { status: 403 },
    );
  }

  const allowedHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
    } catch {
      return null;
    }
  })();

  for (const gen of generations!) {
    if (!gen.result_url) {
      return NextResponse.json(
        { error: `La generación ${gen.id} no tiene result_url` },
        { status: 400 },
      );
    }
    if (allowedHost) {
      try {
        const host = new URL(gen.result_url).host;
        if (host !== allowedHost) {
          return NextResponse.json(
            { error: `La URL de ${gen.id} no proviene de Supabase Storage` },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: `URL inválida para la generación ${gen.id}` },
          { status: 400 },
        );
      }
    }
  }

  const projectIds = Array.from(new Set(generations!.map((g) => g.project_id).filter(Boolean))) as string[];
  let projectsMap = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .in('id', projectIds);
    if (projects) {
      projectsMap = new Map(projects.map((p) => [p.id, p.name as string]));
    }
  }

  const insertRows = generations!.map((g) => ({
    clerk_user_id: userId,
    generation_id: g.id,
    ad_account_id: adAccountId,
    asset_type: classify(g.type),
    source_url: g.result_url!,
    status: 'uploading' as const,
    ad_metadata: metadata?.[g.id] ?? null,
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('meta_uploads')
    .upsert(insertRows, { onConflict: 'generation_id,ad_account_id' })
    .select('*');

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message || 'No se pudieron crear los registros de upload' },
      { status: 500 },
    );
  }

  const uploadById = new Map(inserted.map((u) => [u.generation_id, u]));

  const work = generations!.map((gen) => {
    const upload = uploadById.get(gen.id)!;
    const projectName = (gen.project_id && projectsMap.get(gen.project_id)) || 'Riverz';
    const assetName = `${projectName} – ${gen.id.slice(-6)}`;
    return { gen, upload, assetName };
  });

  let connectionExpired = false;

  const results = await processInChunks(work, CONCURRENCY, async ({ gen, upload, assetName }): Promise<BulkUploadResponseRow> => {
    const assetType = classify(gen.type);
    try {
      if (assetType === 'image') {
        const result = await uploadImageFromUrl(token, adAccountId, gen.result_url!, assetName);
        await supabaseAdmin
          .from('meta_uploads')
          .update({
            status: 'ready',
            meta_asset_hash: result.hash,
            error_message: null,
          })
          .eq('id', upload.id);
        return {
          id: upload.id,
          generation_id: gen.id,
          asset_type: 'image',
          status: 'ready',
          meta_asset_hash: result.hash,
        };
      }
      const result = await uploadVideoFromUrl(token, adAccountId, gen.result_url!, assetName);
      await supabaseAdmin
        .from('meta_uploads')
        .update({
          status: 'processing',
          meta_asset_id: result.id,
          error_message: null,
        })
        .eq('id', upload.id);
      return {
        id: upload.id,
        generation_id: gen.id,
        asset_type: 'video',
        status: 'processing',
        meta_asset_id: result.id,
      };
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      if (err instanceof MetaAuthError) connectionExpired = true;
      const meta = err instanceof MetaApiError ? `[${err.code ?? '?'}] ${message}` : message;
      await supabaseAdmin
        .from('meta_uploads')
        .update({ status: 'failed', error_message: meta })
        .eq('id', upload.id);
      return {
        id: upload.id,
        generation_id: gen.id,
        asset_type: assetType,
        status: 'failed',
        error_message: meta,
      };
    }
  });

  if (connectionExpired) {
    await supabaseAdmin
      .from('meta_connections')
      .update({ status: 'expired', last_error: 'Token rechazado por Meta' })
      .eq('clerk_user_id', userId);
  }

  const response: BulkUploadResponse = { uploads: results };
  return NextResponse.json(response);
}
