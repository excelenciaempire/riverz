import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createCreditPurchaseSession } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    const { credits } = await req.json();

    if (!credits || credits < 500) {
      return NextResponse.json(
        { error: 'Minimum purchase is 500 credits' },
        { status: 400 }
      );
    }

    const session = await createCreditPurchaseSession({
      credits,
      userId,
      userEmail: user?.emailAddresses?.[0]?.emailAddress || '',
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?credits_added=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating credit purchase session:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase session' },
      { status: 500 }
    );
  }
}

