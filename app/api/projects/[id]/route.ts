import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    const supabase = await createClient();

    // Get Project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('clerk_user_id', userId)
      .single();

    if (projectError) {
      return new NextResponse('Project not found', { status: 404 });
    }

    // Get Generations (Images)
    const { data: generations, error: genError } = await supabase
      .from('generations')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (genError) throw genError;

    return NextResponse.json({ ...project, generations });
  } catch (error) {
    console.error('Error fetching project:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
