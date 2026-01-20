import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's internal credits from database
    const { data: userData, error } = await supabaseAdmin
      .from('user_credits')
      .select('credits, plan_type, subscription_status')
      .eq('clerk_user_id', userId)
      .single();

    if (error || !userData) {
      // Create default entry if not exists
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('user_credits')
        .insert({
          clerk_user_id: userId,
          credits: 0,
          plan_type: 'free',
          subscription_status: 'inactive'
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ credits: 0, plan_type: 'free' });
      }
      
      return NextResponse.json({
        credits: newUser.credits,
        plan_type: newUser.plan_type,
        subscription_status: newUser.subscription_status
      });
    }

    return NextResponse.json({
      credits: userData.credits,
      plan_type: userData.plan_type,
      subscription_status: userData.subscription_status
    });

  } catch (error: any) {
    console.error('Error fetching credits:', error);
    return NextResponse.json({ credits: 0, error: error.message }, { status: 200 });
  }
}
