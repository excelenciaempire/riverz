import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
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
  // Verificar que tenemos el webhook secret
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env.local');
  }

  // Obtener headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // Si no hay headers, error
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing svix headers', {
      status: 400,
    });
  }

  // Obtener el body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Crear instancia de Svix
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verificar el webhook
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error: Verification failed', {
      status: 400,
    });
  }

  // Manejar el evento
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    
    const email = email_addresses[0]?.email_address || '';
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();

    try {
      // Crear entrada en user_credits
      const { data, error } = await supabaseAdmin
        .from('user_credits')
        .insert({
          clerk_user_id: id,
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
        console.error('Error creating user_credits:', error);
        return NextResponse.json(
          { error: 'Failed to create user credits' },
          { status: 500 }
        );
      }

      console.log('✅ User credits created:', data);
      return NextResponse.json({ success: true, data });
    } catch (error) {
      console.error('Error in user.created webhook:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    
    const email = email_addresses[0]?.email_address || '';
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();

    try {
      // Actualizar entrada en user_credits
      const { data, error } = await supabaseAdmin
        .from('user_credits')
        .update({
          email: email,
          full_name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user_credits:', error);
        return NextResponse.json(
          { error: 'Failed to update user credits' },
          { status: 500 }
        );
      }

      console.log('✅ User credits updated:', data);
      return NextResponse.json({ success: true, data });
    } catch (error) {
      console.error('Error in user.updated webhook:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    try {
      // Marcar como inactivo en lugar de eliminar
      const { data, error } = await supabaseAdmin
        .from('user_credits')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', id)
        .select()
        .single();

      if (error) {
        console.error('Error deactivating user_credits:', error);
        return NextResponse.json(
          { error: 'Failed to deactivate user credits' },
          { status: 500 }
        );
      }

      console.log('✅ User credits deactivated:', data);
      return NextResponse.json({ success: true, data });
    } catch (error) {
      console.error('Error in user.deleted webhook:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
