import { auth } from '@clerk/nextjs/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    // Verify the generation belongs to the user
    const { data: generation, error: genError } = await supabaseAdmin
      .from('generations')
      .select('id, user_id, result_url, project_id')
      .eq('id', id)
      .single();

    if (genError || !generation) {
      return new NextResponse('Generation not found', { status: 404 });
    }

    // Verify ownership through the user_id field
    if (generation.user_id !== userId) {
      return new NextResponse('Unauthorized', { status: 403 });
    }

    // Delete from storage if it's our URL
    if (generation.result_url?.includes('supabase')) {
      try {
        // Extract path from URL
        const url = new URL(generation.result_url);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/generations\/(.+)/);
        if (pathMatch) {
          await supabaseAdmin.storage
            .from('generations')
            .remove([pathMatch[1]]);
        }
      } catch (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Continue with database deletion
      }
    }

    // Delete the generation
    const { error: deleteError } = await supabaseAdmin
      .from('generations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: 'Generation deleted' });
  } catch (error) {
    console.error('Error deleting generation:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
