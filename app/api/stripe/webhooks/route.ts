import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

// Usar service_role para bypass RLS
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

// Mapeo de planes a créditos
const PLAN_CREDITS = {
  basic: 2000,
  pro: 5500,
  premium: 12000,
};

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
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
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Manejar eventos
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerk_user_id;

        if (!clerkUserId) {
          console.error('No clerk_user_id in session metadata');
          break;
        }

        // Verificar si es suscripción o compra única
        if (session.mode === 'subscription') {
          // Suscripción
          const planType = session.metadata?.plan_type as 'basic' | 'pro' | 'premium';
          const credits = PLAN_CREDITS[planType] || 0;

          // Actualizar user_credits
          const { error: updateError } = await supabaseAdmin
            .from('user_credits')
            .update({
              plan_type: planType,
              credits: credits,
              subscription_status: 'active',
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_start_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('clerk_user_id', clerkUserId);

          if (updateError) {
            console.error('Error updating user_credits:', updateError);
            break;
          }

          // Registrar transacción
          await supabaseAdmin.from('credit_transactions').insert({
            clerk_user_id: clerkUserId,
            amount: credits,
            transaction_type: 'subscription',
            description: `Suscripción ${planType} activada`,
            balance_after: credits,
          });

          console.log(`✅ Subscription activated for user ${clerkUserId}: ${planType}`);
        } else if (session.mode === 'payment') {
          // Compra única de créditos
          const creditsToAdd = parseInt(session.metadata?.credits || '0');

          if (creditsToAdd > 0) {
            // Obtener balance actual
            const { data: userCredits } = await supabaseAdmin
              .from('user_credits')
              .select('credits')
              .eq('clerk_user_id', clerkUserId)
              .single();

            const currentCredits = userCredits?.credits || 0;
            const newBalance = currentCredits + creditsToAdd;

            // Actualizar créditos
            const { error: updateError } = await supabaseAdmin
              .from('user_credits')
              .update({
                credits: newBalance,
                updated_at: new Date().toISOString(),
              })
              .eq('clerk_user_id', clerkUserId);

            if (updateError) {
              console.error('Error updating credits:', updateError);
              break;
            }

            // Registrar transacción
            await supabaseAdmin.from('credit_transactions').insert({
              clerk_user_id: clerkUserId,
              amount: creditsToAdd,
              transaction_type: 'purchase',
              description: `Compra de ${creditsToAdd} créditos`,
              balance_after: newBalance,
            });

            console.log(`✅ Credits purchased for user ${clerkUserId}: ${creditsToAdd}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const clerkUserId = subscription.metadata?.clerk_user_id;

        if (!clerkUserId) {
          console.error('No clerk_user_id in subscription metadata');
          break;
        }

        const status = subscription.status;
        let subscriptionStatus = 'inactive';

        if (status === 'active' || status === 'trialing') {
          subscriptionStatus = 'active';
        } else if (status === 'past_due') {
          subscriptionStatus = 'past_due';
        } else if (status === 'canceled' || status === 'unpaid') {
          subscriptionStatus = 'cancelled';
        }

        // Actualizar estado de suscripción
        await supabaseAdmin
          .from('user_credits')
          .update({
            subscription_status: subscriptionStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', clerkUserId);

        console.log(`✅ Subscription updated for user ${clerkUserId}: ${subscriptionStatus}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const clerkUserId = subscription.metadata?.clerk_user_id;

        if (!clerkUserId) {
          console.error('No clerk_user_id in subscription metadata');
          break;
        }

        // Cancelar suscripción y resetear a plan free
        await supabaseAdmin
          .from('user_credits')
          .update({
            plan_type: 'free',
            subscription_status: 'cancelled',
            subscription_end_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', clerkUserId);

        console.log(`✅ Subscription cancelled for user ${clerkUserId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription;

        if (!subscription) break;

        // Obtener la suscripción para obtener el metadata
        const subscriptionData = await stripe.subscriptions.retrieve(subscription as string);
        const clerkUserId = subscriptionData.metadata?.clerk_user_id;
        const planType = subscriptionData.metadata?.plan_type as 'basic' | 'pro' | 'premium';

        if (!clerkUserId || !planType) break;

        // Renovar créditos mensuales
        const credits = PLAN_CREDITS[planType] || 0;

        await supabaseAdmin
          .from('user_credits')
          .update({
            credits: credits,
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', clerkUserId);

        // Registrar transacción
        await supabaseAdmin.from('credit_transactions').insert({
          clerk_user_id: clerkUserId,
          amount: credits,
          transaction_type: 'subscription',
          description: `Renovación mensual ${planType}`,
          balance_after: credits,
        });

        console.log(`✅ Monthly credits renewed for user ${clerkUserId}: ${credits}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription;

        if (!subscription) break;

        const subscriptionData = await stripe.subscriptions.retrieve(subscription as string);
        const clerkUserId = subscriptionData.metadata?.clerk_user_id;

        if (!clerkUserId) break;

        // Marcar suscripción como past_due
        await supabaseAdmin
          .from('user_credits')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', clerkUserId);

        console.log(`⚠️ Payment failed for user ${clerkUserId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

