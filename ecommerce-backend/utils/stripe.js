import Stripe from 'stripe';
import { refusal } from './refusal.js';

const secretKey = process.env.STRIPE_SECRET_KEY;
// This is a demo store, so only a test key turns card payment on. A live key would take real money
const isTestKey = /^(sk|rk)_test_/.test(secretKey ?? '');
if (secretKey && !isTestKey) {
  console.warn('STRIPE_SECRET_KEY is not a test key, so card payment is off.');
}

// STRIPE_API_URL is only for tests, which point the client at a local stand-in for Stripe
const apiUrl = process.env.STRIPE_API_URL && new URL(process.env.STRIPE_API_URL);

// Without a key, card payment is off and the store works as before
export const stripe = isTestKey
  ? new Stripe(secretKey, apiUrl ? {
    host: apiUrl.hostname,
    port: apiUrl.port,
    protocol: apiUrl.protocol.slice(0, -1)
  } : {})
  : null;

// The Stripe sandbox is shared with another app, so this store tags its sessions and skips the rest
export const APP_TAG = 'react-ecommerce';

// Refunds the whole payment of a card order, or returns why it couldn't. The key makes Stripe
// answer a repeated request with the first refund instead of refunding again
export async function refundCardOrder(order) {
  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (session.metadata?.app !== APP_TAG || !session.payment_intent) {
      return { status: 409, ...refusal('refundNotAllowed', "This order's payment can't be refunded by the store.") };
    }
    await stripe.refunds.create(
      { payment_intent: session.payment_intent, metadata: { app: APP_TAG, orderId: order.id } },
      { idempotencyKey: `refund-order-${order.id}` }
    );
    return null;
  } catch (error) {
    // Refunded already, for example in the Stripe Dashboard
    if (error.code === 'charge_already_refunded') {
      return null;
    }
    console.error(`Refunding order ${order.id} failed:`, error.message);
    return { status: 502, ...refusal('refundFailed', "The refund didn't go through, so the order wasn't cancelled. Please try again later.") };
  }
}
