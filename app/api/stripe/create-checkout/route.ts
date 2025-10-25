import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createCheckoutSession, SUBSCRIPTION_PLANS } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = await auth();
    const { planType } = await req.json();

    const plan = SUBSCRIPTION_PLANS[planType as keyof typeof SUBSCRIPTION_PLANS];

    if (!plan || !plan.priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const session = await createCheckoutSession({
      priceId: plan.priceId,
      userId,
      userEmail: user?.emailAddresses[0]?.emailAddress || '',
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?success=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

