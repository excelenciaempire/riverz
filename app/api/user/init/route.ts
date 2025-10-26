import { auth, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Crear cliente de Supabase con service_role para bypass RLS
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

    // Verificar si el usuario ya existe
    const { data: existingUser } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('clerk_user_id', userId)
      .single();

    if (existingUser) {
      return NextResponse.json({ 
        message: 'User already exists', 
        data: existingUser 
      });
    }

    // Crear usuario
    const email = user.emailAddresses[0]?.emailAddress || '';
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .insert({
        clerk_user_id: userId,
        email: email,
        full_name: fullName,
        plan_type: 'free',
        credits: 0,
        subscription_status: 'inactive',
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: 'Failed to create user', details: error },
        { status: 500 }
      );
    }

    console.log('✅ User created:', data);
    return NextResponse.json({ 
      message: 'User created successfully', 
      data 
    });
  } catch (error: any) {
    console.error('Error initializing user:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

