import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export const CREDIT_PRICE = 0.01; // $0.01 per credit
export const MIN_CREDIT_PURCHASE = 500; // Minimum 500 credits = $5

export const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Básico',
    price: 19,
    credits: 2000,
    priceId: process.env.STRIPE_BASIC_PRICE_ID || '',
  },
  pro: {
    name: 'Pro',
    price: 49,
    credits: 5500,
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
  },
  premium: {
    name: 'Premium',
    price: 99,
    credits: 12000,
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID || '',
  },
};

export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
}: {
  priceId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return await stripe.checkout.sessions.create({
    customer_email: userEmail,
    client_reference_id: userId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
  });
}

export async function createCreditPurchaseSession({
  credits,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
}: {
  credits: number;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const amount = Math.max(credits, MIN_CREDIT_PURCHASE) * CREDIT_PRICE;

  return await stripe.checkout.sessions.create({
    customer_email: userEmail,
    client_reference_id: userId,
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${credits} Créditos`,
            description: 'Recarga de créditos para Riverz',
          },
          unit_amount: Math.round(CREDIT_PRICE * 100), // Convert to cents
        },
        quantity: credits,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      credits: credits.toString(),
      type: 'credit_purchase',
    },
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

