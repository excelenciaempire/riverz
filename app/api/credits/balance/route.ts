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

    // Consultar balance de créditos
    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .select('credits, plan_type, subscription_status')
      .eq('clerk_user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching credits balance:', error);
      
      // Si el usuario no existe, retornar 0 créditos
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          credits: 0,
          plan_type: 'free',
          subscription_status: 'inactive'
        });
      }
      
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in credits/balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits balance' },
      { status: 500 }
    );
  }
}


