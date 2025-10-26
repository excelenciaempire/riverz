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
      .from('admin_config')
      .select('*')
      .like('key', 'n8n_%');

    if (error) {
      console.error('Error fetching N8N config:', error);
      throw error;
    }

    // Convertir array a objeto para facilitar el uso
    const config = data?.reduce((acc: any, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {}) || {};

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('Error in admin N8N config route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch N8N config' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const { key, value } = await req.json();

    if (!key || !key.startsWith('n8n_')) {
      return NextResponse.json(
        { error: 'Invalid key - must start with n8n_' },
        { status: 400 }
      );
    }

    // Upsert (actualizar o insertar)
    const { data, error } = await supabaseAdmin
      .from('admin_config')
      .upsert({
        key,
        value: value || '',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating N8N config:', error);
      throw error;
    }

    return NextResponse.json({ success: true, config: data });
  } catch (error: any) {
    console.error('Error updating N8N config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update N8N config' },
      { status: 500 }
    );
  }
}

