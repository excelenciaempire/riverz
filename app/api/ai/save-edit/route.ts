import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { generationId, newImageUrl } = await req.json();

    if (!generationId || !newImageUrl) {
      return NextResponse.json({ error: 'Missing generationId or newImageUrl' }, { status: 400 });
    }

    // Verify ownership and update the generation
    const { data: generation, error: fetchError } = await supabase
      .from('generations')
      .select('clerk_user_id, result_url, input_data')
      .eq('id', generationId)
      .single();

    if (fetchError || !generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    if (generation.clerk_user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized to edit this generation' }, { status: 403 });
    }

    // Store the original URL in edit history
    const editHistory = generation.input_data?.editHistory || [];
    editHistory.push({
      previousUrl: generation.result_url,
      editedAt: new Date().toISOString()
    });

    // Update the generation with new image URL
    const { error: updateError } = await supabase
      .from('generations')
      .update({
        result_url: newImageUrl,
        input_data: {
          ...generation.input_data,
          editHistory,
          lastEditedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', generationId);

    if (updateError) {
      console.error('Error updating generation:', updateError);
      return NextResponse.json({ error: 'Failed to save edit' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Imagen guardada correctamente',
      newUrl: newImageUrl
    });

  } catch (error: any) {
    console.error('Error saving edit:', error);
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
  }
}
