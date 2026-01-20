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
    const { amount } = body; // amount in USD (minimum $5)

    if (!amount || amount < 5) {
      return NextResponse.json(
        { error: 'Minimum purchase is $5 USD' },
        { status: 400 }
      );
    }

    // Calcular créditos: $1 = 100 créditos
    const credits = amount * 100;

    // Inicializar Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });

    // Crear sesión de checkout para compra única
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Créditos Riverz',
              description: `${credits} créditos para generaciones`,
            },
            unit_amount: amount * 100, // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?success=true&credits=${credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracion?canceled=true`,
      customer_email: user.emailAddresses[0]?.emailAddress,
      client_reference_id: userId,
      metadata: {
        clerk_user_id: userId,
        credits: credits.toString(),
        transaction_type: 'purchase',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating credits checkout:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

