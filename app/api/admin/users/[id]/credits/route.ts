import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function isAdmin(userEmail: string): Promise<boolean> {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(userEmail.toLowerCase());
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail || !(await isAdmin(userEmail))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const { amount, action, reason } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (!action || !['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "add" or "remove"' },
        { status: 400 }
      );
    }

    // Obtener balance actual
    const { data: userCredits, error: fetchError } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('clerk_user_id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching user credits:', fetchError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentCredits = userCredits.credits || 0;
    let newBalance: number;

    if (action === 'add') {
      newBalance = currentCredits + amount;
    } else {
      // remove
      if (currentCredits < amount) {
        return NextResponse.json(
          { error: 'Insufficient credits to remove' },
          { status: 400 }
        );
      }
      newBalance = currentCredits - amount;
    }

    // Actualizar créditos
    const { error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', id);

    if (updateError) {
      console.error('Error updating credits:', updateError);
      throw updateError;
    }

    // Registrar transacción
    await supabaseAdmin.from('credit_transactions').insert({
      clerk_user_id: id,
      amount: action === 'add' ? amount : -amount,
      transaction_type: 'admin_grant',
      description: reason || `Admin ${action} credits`,
      balance_after: newBalance,
    });

    return NextResponse.json({
      success: true,
      newBalance,
      action,
      amount,
    });
  } catch (error: any) {
    console.error('Error managing user credits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to manage credits' },
      { status: 500 }
    );
  }
}


