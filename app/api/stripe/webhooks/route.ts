import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;

        if (!userId) break;

        // Check if this is a subscription or credit purchase
        if (session.mode === 'subscription') {
          // Update user plan and credits
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const planType = getPlanTypeFromPriceId(subscription.items.data[0].price.id);
          const credits = getCreditsForPlan(planType);

          await supabase
            .from('users')
            .update({
              plan_type: planType,
              credits,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
            })
            .eq('clerk_id', userId);
        } else if (session.metadata?.type === 'credit_purchase') {
          // Add credits to user account
          const credits = parseInt(session.metadata.credits || '0');

          const { data: user } = await supabase
            .from('users')
            .select('credits')
            .eq('clerk_id', userId)
            .single();

          if (user) {
            await supabase
              .from('users')
              .update({
                credits: user.credits + credits,
              })
              .eq('clerk_id', userId);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const planType = getPlanTypeFromPriceId(subscription.items.data[0].price.id);

        await supabase
          .from('users')
          .update({
            plan_type: planType,
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await supabase
          .from('users')
          .update({
            plan_type: 'free',
            stripe_subscription_id: null,
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

function getPlanTypeFromPriceId(priceId: string): string {
  // Map price IDs to plan types
  // This should match your Stripe product price IDs
  if (priceId === process.env.STRIPE_BASIC_PRICE_ID) return 'basic';
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return 'premium';
  return 'free';
}

function getCreditsForPlan(planType: string): number {
  const credits = {
    free: 0,
    basic: 2000,
    pro: 5500,
    premium: 12000,
  };
  return credits[planType as keyof typeof credits] || 0;
}

