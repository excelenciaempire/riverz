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

    if (generation.status === 'completed' || generation.status === 'failed') {
      return NextResponse.json({
        status: generation.status,
        result_url: generation.result_url,
        error_message: generation.error_message,
        generationId: generation.id,
      });
    }

    try {
      // Determinar el endpoint correcto según el tipo
      const endpoint = generation.type === 'mejorar_calidad_video'
        ? N8N_ENDPOINTS.mejorarCalidadVideo
        : N8N_ENDPOINTS.mejorarCalidadImagen;

      const result = await pollN8NResult(jobId, endpoint);

      if (result.status === 'completed') {
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
        return NextResponse.json({
          status: 'processing',
          generationId: generation.id,
        });
      }
    } catch (pollError: any) {
      console.error('Error polling N8N:', pollError);
      
      if (pollError.message?.includes('not configured')) {
        return NextResponse.json({
          status: 'processing',
          message: 'N8N endpoint not configured',
          generationId: generation.id,
        });
      }

      return NextResponse.json({
        status: 'processing',
        generationId: generation.id,
      });
    }
  } catch (error: any) {
    console.error('Error checking quality enhancement status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}


