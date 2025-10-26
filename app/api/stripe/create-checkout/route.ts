import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    // Importación dinámica de Clerk para evitar errores en build
    const { auth, currentUser } = await import('@clerk/nextjs/server');
    
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { priceId, planType } = body;

    if (!priceId || !planType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validar que el planType sea válido
    const validPlans = ['basic', 'pro', 'premium'];
    if (!validPlans.includes(planType)) {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    // Inicializar Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-09-30.clover',
    });

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?canceled=true`,
      customer_email: user.emailAddresses[0]?.emailAddress,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        plan_type: planType,
      },
      subscription_data: {
        metadata: {
          clerk_user_id: userId,
          plan_type: planType,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

