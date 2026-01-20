import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return new NextResponse('Missing filename or contentType', { status: 400 });
    }

    // Initialize Supabase Admin Client (Service Role)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const bucket = 'products';
    const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${userId}/${Date.now()}_${cleanName}`;

    // Create a Signed Upload URL (valid for 60 seconds)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error('Supabase Signed URL Error:', error);
      return new NextResponse(`Failed to generate upload URL: ${error.message}`, { status: 500 });
    }

    // Get the Public URL for the file (assuming bucket is public)
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return NextResponse.json({ 
      signedUrl: data.signedUrl, 
      path: data.path,
      token: data.token,
      publicUrl: publicUrlData.publicUrl 
    });

  } catch (error: any) {
    console.error('Upload API Error:', error);
    return new NextResponse(`Internal Error: ${error.message}`, { status: 500 });
  }
}
