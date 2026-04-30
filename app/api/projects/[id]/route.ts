import { auth } from '@clerk/nextjs/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Polling clients hit this endpoint every 2s — never cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    // Project ownership is verified via Clerk + clerk_user_id filter. After
    // that, use the service-role client for the generations read so the
    // response is never partially blocked by RLS quirks (this used to be
    // why some projects rendered with project metadata but zero rows).
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('clerk_user_id', userId)
      .single();

    if (projectError || !project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const { data: generations, error: genError } = await supabaseAdmin
      .from('generations')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (genError) throw genError;

    return NextResponse.json({ ...project, generations: generations || [] });
  } catch (error) {
    console.error('Error fetching project:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// DELETE project and all its generations
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    // Verify the project belongs to the user
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('clerk_user_id', userId)
      .single();

    if (projectError || !project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    // Delete all generations for this project
    const { error: genDeleteError } = await supabaseAdmin
      .from('generations')
      .delete()
      .eq('project_id', id);

    if (genDeleteError) {
      console.error('Error deleting generations:', genDeleteError);
    }

    // Delete the project
    const { error: projectDeleteError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', id);

    if (projectDeleteError) {
      throw projectDeleteError;
    }

    return NextResponse.json({ success: true, message: 'Proyecto eliminado' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// PATCH to cancel project (update status)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const { action } = await req.json();

    if (action === 'cancel') {
      // Update project status to cancelled
      const { error: projectError } = await supabaseAdmin
        .from('projects')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('clerk_user_id', userId);

      if (projectError) throw projectError;

      // Cancel all pending/processing generations
      const { error: genError } = await supabaseAdmin
        .from('generations')
        .update({ status: 'failed', error_message: 'Cancelado por el usuario' })
        .eq('project_id', id)
        .in('status', ['pending_analysis', 'analyzing', 'generating', 'processing']);

      if (genError) throw genError;

      return NextResponse.json({ success: true, message: 'Proceso cancelado' });
    }

    return new NextResponse('Invalid action', { status: 400 });
  } catch (error) {
    console.error('Error updating project:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
