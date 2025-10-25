import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current credits
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', userId)
      .single();

    if (fetchError) throw fetchError;

    if (user.credits < amount) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 400 }
      );
    }

    // Deduct credits
    const { data, error: updateError } = await supabase
      .from('users')
      .update({ credits: user.credits - amount })
      .eq('clerk_id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, credits: data.credits });
  } catch (error) {
    console.error('Error deducting credits:', error);
    return NextResponse.json(
      { error: 'Failed to deduct credits' },
      { status: 500 }
    );
  }
}

