import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Usar admin client con service role key
    const supabaseAdmin = createAdminClient();

    // Consultar user_credits
    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('clerk_user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user credits:', error);
      
      // Si el usuario no existe en user_credits, retornar valores por defecto
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          clerk_user_id: userId,
          plan_type: 'free',
          credits: 0,
          subscription_status: 'inactive'
        });
      }
      
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Usar admin client con service role key
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .update(body)
      .eq('clerk_user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

