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

export async function GET() {
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

    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .select('*')
      .order('mode', { ascending: true });

    if (error) {
      console.error('Error fetching pricing:', error);
      throw error;
    }

    return NextResponse.json({ pricing: data || [] });
  } catch (error: any) {
    console.error('Error in admin pricing route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pricing' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
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

    const { mode, credits_cost } = await req.json();

    if (!mode || credits_cost === undefined || credits_cost < 0) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('pricing_config')
      .update({
        credits_cost,
        updated_at: new Date().toISOString(),
      })
      .eq('mode', mode)
      .select()
      .single();

    if (error) {
      console.error('Error updating pricing:', error);
      throw error;
    }

    return NextResponse.json({ success: true, pricing: data });
  } catch (error: any) {
    console.error('Error updating pricing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update pricing' },
      { status: 500 }
    );
  }
}


