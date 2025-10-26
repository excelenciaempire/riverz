import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pollN8NResult, N8N_ENDPOINTS } from '@/lib/n8n';

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = params;
    const supabase = await createClient();

    // Buscar la generación por n8n_job_id
    const { data: generation, error } = await supabase
      .from('generations')
      .select('*')
      .eq('n8n_job_id', jobId)
      .eq('clerk_user_id', userId)
      .single();

    if (error || !generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    // Si ya está completado o failed, retornar el estado actual
    if (generation.status === 'completed' || generation.status === 'failed') {
      return NextResponse.json({
        status: generation.status,
        result_url: generation.result_url,
        error_message: generation.error_message,
        generationId: generation.id,
      });
    }

    // Si está en processing, consultar N8N
    try {
      const result = await pollN8NResult(jobId, N8N_ENDPOINTS.ugc);

      if (result.status === 'completed') {
        // Actualizar generación con resultado
        await supabase
          .from('generations')
          .update({
            status: 'completed',
            result_url: result.result_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id);

        return NextResponse.json({
          status: 'completed',
          result_url: result.result_url,
          generationId: generation.id,
        });
      } else if (result.status === 'failed') {
        // Actualizar generación con error
        await supabase
          .from('generations')
          .update({
            status: 'failed',
            error_message: result.error || 'Generation failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', generation.id);

        return NextResponse.json({
          status: 'failed',
          error_message: result.error,
          generationId: generation.id,
        });
      } else {
        // Todavía procesando
        return NextResponse.json({
          status: 'processing',
          generationId: generation.id,
        });
      }
    } catch (pollError: any) {
      console.error('Error polling N8N:', pollError);
      
      // Si el error es porque N8N no está configurado, retornar un mensaje descriptivo
      if (pollError.message?.includes('not configured')) {
        return NextResponse.json({
          status: 'processing',
          message: 'N8N endpoint not configured. Please configure N8N webhooks.',
          generationId: generation.id,
        });
      }

      return NextResponse.json({
        status: 'processing',
        generationId: generation.id,
      });
    }
  } catch (error: any) {
    console.error('Error checking UGC status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}


