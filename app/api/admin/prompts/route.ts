import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch all prompts
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = await createClient();
    
    const { data: prompts, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(prompts);
  } catch (error: any) {
    console.error('[PROMPTS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// POST - Create new prompt
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { key, name, category, prompt_text, description, variables, is_active } = body;

    if (!key || !name || !category || !prompt_text) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    const supabase = await createClient();
    
    const { data: prompt, error } = await supabase
      .from('ai_prompts')
      .insert({
        key,
        name,
        category,
        prompt_text,
        description,
        variables: variables || [],
        is_active: is_active ?? true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(prompt);
  } catch (error: any) {
    console.error('[PROMPTS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// PATCH - Update prompt
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return new NextResponse('Missing prompt ID', { status: 400 });
    }

    const supabase = await createClient();
    
    const { data: prompt, error } = await supabase
      .from('ai_prompts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(prompt);
  } catch (error: any) {
    console.error('[PROMPTS_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// DELETE - Delete prompt
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return new NextResponse('Missing prompt ID', { status: 400 });
    }

    const supabase = await createClient();
    
    const { error } = await supabase
      .from('ai_prompts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PROMPTS_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
