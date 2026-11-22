import express, { type NextFunction, type Request, type Response } from 'express';
import type Stripe from 'stripe';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { requireVisitor } from '../middleware/visitor.ts';
import { CartItem } from '../models/CartItem.ts';
import { Order } from '../models/Order.ts';
import { Product } from '../models/Product.ts';
import { calculatePaymentSummary } from './paymentSummary.ts';
import { createOrder, getCustomerName, getOrderRefusal, type OrderItem } from './orders.ts';
import { corsOrigins } from '../utils/corsOrigins.ts';
import { publicSiteUrl } from '../utils/publicSiteUrl.ts';
import { APP_TAG, requireStripeClient, stripe } from '../utils/stripe.ts';
import { takePaidStock } from '../utils/stock.ts';
import { readCoupon } from '../middleware/coupon.ts';
import { sendRefusal } from '../utils/refusal.ts';
import { checkoutLimit } from '../middleware/rateLimits.ts';

const router = express.Router();

router.param('sessionId', (req, res, next, id) => (
  /^cs_\w+$/.test(id) ? next() : res.status(404).json({ error: 'Payment not found' })
));

function lineItem(
  name: string, unitAmountCents: number, quantity = 1, metadata?: Record<string, string>
): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    price_data: { currency: 'eur', unit_amount: unitAmountCents, product_data: { name, metadata } },
    quantity
  };
}

// Stripe sends the customer back to the store they came from, so it has to be one of ours
function isStoreOrigin(req: Request, origin: string | undefined): origin is string {
  return origin !== undefined && (corsOrigins.includes(origin) || URL.parse(origin)?.host === req.get('host'));
}

// The webhook and the success page both get here for the same payment, maybe at the same
// time. The unique session ID lets only one of them create the order, and only it clears the cart
async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const findOrder = () => Order.findOne({ where: { stripeSessionId: session.id } });
  const existingOrder = await findOrder();
  if (existingOrder) {
    return existingOrder;
  }

  const lineItems = await requireStripeClient().checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ['data.price.product']
  });
  // The product lines carry the cart item they came from; shipping and tax lines don't
  const items: OrderItem[] = lineItems.data.flatMap((line) => {
    const product = line.price?.product;
    const metadata = typeof product === 'object' && product !== null && 'metadata' in product ? product.metadata : {};
    const { productId, deliveryOptionId } = metadata;
    return productId && deliveryOptionId && line.quantity ? [{ productId, deliveryOptionId, quantity: line.quantity }] : [];
  });
  const visitorId = session.metadata?.visitorId;
  if (!visitorId || session.amount_total === null) {
    throw new Error(`Checkout session ${session.id} has no visitor or total.`);
  }

  let order;
  try {
    order = await createOrder(visitorId, items, {
      totalCostCents: session.amount_total,
      paymentMethod: 'card',
      stripeSessionId: session.id,
      customerName: session.metadata?.customerName ?? null
    });
  } catch (error) {
    const orderFromOtherPath = await findOrder();
    if (orderFromOtherPath) {
      return orderFromOtherPath;
    }
    throw error;
  }

  await takePaidStock(items);
  await CartItem.destroy({ where: { visitorId } });
  return order;
}

function requireStripe(req: Request, res: Response, next: NextFunction) {
  if (!stripe) {
    return res.status(404).json({ error: 'Card payment is not available' });
  }
  next();
}

router.get('/config', (req, res) => {
  res.json({ cardPayment: Boolean(stripe) });
});

router.use(requireStripe);

router.post('/checkout-sessions', checkoutLimit, requireVisitor, readCoupon, asyncHandler(async (req, res) => {
  const requestOrigin = req.get('Origin');
  if (!isStoreOrigin(req, requestOrigin)) {
    return res.status(400).json({ error: 'Card payment only works from the store' });
  }
  const origin = publicSiteUrl || requestOrigin;

  const cartItems = await CartItem.findAll({ where: { visitorId: req.visitorId } });
  const orderRefusal = await getOrderRefusal(req.visitorId, cartItems);
  if (orderRefusal) {
    return sendRefusal(res, orderRefusal);
  }

  // Each line comes from the database, and together they add up to the payment summary's total
  const productLines = await Promise.all(cartItems.map(async ({ productId, quantity, deliveryOptionId }) => {
    const product = await Product.findByPk(productId, { paranoid: false });
    if (!product) {
      throw new Error(`The product of cart item ${productId} doesn't exist.`);
    }
    return lineItem(product.name, product.priceCents, quantity, { productId, deliveryOptionId });
  }));
  const { coupon } = req;
  const { shippingCostCents, taxCents, discountCents } = await calculatePaymentSummary(cartItems, coupon ?? null);
  const extraCharges: [string, number][] = [
    ['Shipping & handling', shippingCostCents],
    ['Estimated tax (10%)', taxCents]
  ];
  const extraLines = extraCharges.filter(([, amountCents]) => amountCents > 0).map(([name, amountCents]) => lineItem(name, amountCents));

  // Stripe takes a discount as a coupon of its own, made for this one payment
  const stripeClient = requireStripeClient();
  const discounts = coupon && discountCents > 0 ? [{
    coupon: (await stripeClient.coupons.create({
      amount_off: discountCents,
      currency: 'eur',
      duration: 'once',
      max_redemptions: 1,
      name: `${coupon.code} (${coupon.percentOff}% off)`,
      metadata: { app: APP_TAG }
    })).id
  }] : undefined;

  const session = await stripeClient.checkout.sessions.create({
    mode: 'payment',
    line_items: [...productLines, ...extraLines],
    discounts,
    metadata: { app: APP_TAG, visitorId: req.visitorId, ...(req.user && { customerName: getCustomerName(req.user) }) },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout`
  });

  res.status(201).json({ url: session.url });
}));

// The success page asks for the order, so it appears even without the webhook, as locally
router.get('/checkout-sessions/:sessionId/order', checkoutLimit, requireVisitor, asyncHandler<{ sessionId: string }>(async (req, res) => {
  const session = await requireStripeClient().checkout.sessions.retrieve(req.params.sessionId).catch((error) => {
    if (error.statusCode === 404) {
      return null;
    }
    throw error;
  });
  if (session?.metadata?.app !== APP_TAG || session.metadata.visitorId !== req.visitorId) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  if (session.payment_status !== 'paid') {
    return res.status(409).json({ error: "The payment hasn't gone through." });
  }

  res.json(await fulfillCheckout(session));
}));

// Needs the raw body to check Stripe's signature, so server.ts mounts it before the JSON parser
export const handleWebhook = [requireStripe, asyncHandler(async (req, res) => {
  let event: Stripe.Event;
  try {
    // A missing signature or secret fails the check like a wrong one
    event = requireStripeClient().webhooks.constructEvent(
      req.body, req.get('Stripe-Signature') ?? '', process.env.STRIPE_WEBHOOK_SECRET ?? ''
    );
  } catch {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.metadata?.app === APP_TAG && session.payment_status === 'paid') {
      await fulfillCheckout(session);
    }
  }
  res.json({ received: true });
})];

export default router;
