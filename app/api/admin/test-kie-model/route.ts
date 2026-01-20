import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createKieTask } from '@/lib/kie-client';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    // if (!userId) return new NextResponse('Unauthorized', { status: 401 }); // Allow for testing from admin panel? No, secure it.
    
    // For admin test, maybe we allow it if user is admin. But let's keep simple auth check.
    if (!userId) {
        // Double check admin emails env var logic here if needed, but for now just auth
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { model, type } = await req.json();

    if (!model) {
      return new NextResponse('Missing model', { status: 400 });
    }

    // Try to create a dummy task to verify model validity
    // For Analysis (Vision/LLM), use a simple prompt
    // For Generation (Image), use a simple prompt
    
    let input = {};
    if (type === 'analysis') {
        input = { prompt: 'Test connection' };
    } else {
        input = { prompt: 'Test connection', aspect_ratio: '1:1' };
    }

    try {
        await createKieTask(model, input);
        // If it succeeds (returns task ID), then model is valid
        return NextResponse.json({ success: true });
    } catch (error: any) {
        // If it fails, return error message
        return NextResponse.json({ success: false, error: error.message });
    }

  } catch (error) {
    console.error('Error testing model:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
