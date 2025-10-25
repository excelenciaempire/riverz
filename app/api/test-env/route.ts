import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: process.env.CLERK_SECRET_KEY ? 'SET' : 'NOT SET',
    clerkWebhookSecret: process.env.CLERK_WEBHOOK_SECRET ? 'SET' : 'NOT SET',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET',
  });
}
