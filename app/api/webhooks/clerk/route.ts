import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env');
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400,
    });
  }

  const supabase = createAdminClient();

  try {
    if (evt.type === 'user.created') {
      const { id, email_addresses } = evt.data;

      await supabase.from('users').insert({
        clerk_id: id,
        email: email_addresses[0]?.email_address || '',
        credits: 0,
        plan_type: 'free',
        language: 'es',
      });
    }

    if (evt.type === 'user.updated') {
      const { id, email_addresses } = evt.data;

      await supabase
        .from('users')
        .update({
          email: email_addresses[0]?.email_address || '',
        })
        .eq('clerk_id', id);
    }

    if (evt.type === 'user.deleted') {
      const { id } = evt.data;

      await supabase.from('users').delete().eq('clerk_id', id!);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

