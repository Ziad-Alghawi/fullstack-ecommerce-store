import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addProduct, addToCart, api, baseUrl, cancelOrder, checkout, checkoutCompleted, createProduct,
  createToken, deleteProduct, getAdminOrders, getCart, getOrders, getPaidOrder, getStock, identify,
  newProduct, placeCardOrder, placeOrder, productId, refundsFor, sendWebhook, setOrderStatus,
  setRefundError, startCheckout, startServer, stopServer, stripeLineItems, stripeSessions,
  useTestServer
} from './helpers.js';

useTestServer();

test('pays by card through a Checkout Session priced from the database', async () => {
  const visitorId = randomUUID();
  await addToCart(visitorId);
  await api(`/api/cart-items/${productId}`, {
    visitorId, method: 'PUT', body: { quantity: 2, deliveryOptionId: '2' }
  });
  const summary = await (await api('/api/payment-summary', { visitorId })).json();

  // Prices sent by the browser are ignored
  const response = await api('/api/stripe/checkout-sessions', {
    visitorId, method: 'POST', headers: { Origin: baseUrl }, body: { totalCostCents: 1, priceCents: 1 }
  });
  assert.equal(response.status, 201);
  const session = [...stripeSessions.values()].at(-1);

  assert.equal(session.amount_total, summary.totalCostCents);
  const lines = stripeLineItems.get(session.id).map(({ description, quantity, amount_total }) => [description, quantity, amount_total]);
  assert.deepEqual(lines, [
    ['Gray Hand Knit Wool Socks', 2, 2180],
    ['Shipping & handling', 1, 499],
    ['Estimated tax (10%)', 1, 268]
  ]);
  // Euros are the only currency
  assert.deepEqual(new Set(stripeLineItems.get(session.id).map(({ price }) => price.currency)), new Set(['eur']));
  assert.deepEqual(session.metadata, { app: 'react-ecommerce', visitorId });
  assert.equal(session.success_url, `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  // Cancelling goes back to checkout, where the cart is unchanged
  assert.equal(session.cancel_url, `${baseUrl}/checkout`);
  assert.equal((await getCart(visitorId))[0].quantity, 2);
  assert.deepEqual(await getOrders(visitorId), []);
});

test('refuses a Checkout Session for an empty cart or from another site', async () => {
  const visitorId = randomUUID();
  assert.equal((await checkout(visitorId)).status, 400);

  await addToCart(visitorId);
  assert.equal((await checkout(visitorId, 'https://example.com')).status, 400);
  assert.equal((await checkout(visitorId, 'null')).status, 400);
  assert.equal((await checkout({})).status, 400);
  // The development frontend is allowed by CORS_ORIGIN
  assert.equal((await checkout(visitorId, 'http://localhost:5173')).status, 201);
});

for (const [kind, createVisitor] of [
  ['guest', async () => randomUUID()],
  ['user', async () => ({ token: await createToken() })]
]) {
  test(`a paid session makes one card order for a ${kind}, even when the webhook and success page both run`, async () => {
    const visitor = await createVisitor();
    await addToCart(visitor);
    const summary = await (await api('/api/payment-summary', identify(visitor))).json();
    const stockBefore = await getStock(productId);
    const session = await startCheckout(visitor);

    assert.equal((await getPaidOrder(visitor, session)).status, 409);
    assert.equal((await getCart(visitor)).length, 1);

    session.payment_status = 'paid';
    // Both paths at once, with the success page loaded twice
    const responses = await Promise.all([
      sendWebhook(checkoutCompleted(session)),
      getPaidOrder(visitor, session),
      getPaidOrder(visitor, session)
    ]);
    assert.deepEqual(responses.map(({ status }) => status), [200, 200, 200]);
    const [, first, second] = await Promise.all(responses.map((response) => response.json()));
    assert.equal(first.id, second.id);

    const orders = await getOrders(visitor);
    assert.deepEqual(orders.map(({ id }) => id), [first.id]);
    assert.equal(orders[0].paymentMethod, 'card');
    assert.equal(orders[0].totalCostCents, summary.totalCostCents);
    assert.equal(await getStock(productId), stockBefore - 1);
    assert.deepEqual(orders[0].products.map(({ productId, quantity }) => ({ productId, quantity })), [{ productId, quantity: 1 }]);
    assert.deepEqual(await getCart(visitor), []);

    // A late webhook or reload leaves the next cart alone
    await addToCart(visitor);
    assert.equal((await sendWebhook(checkoutCompleted(session))).status, 200);
    assert.equal((await getPaidOrder(visitor, session)).status, 200);
    assert.equal((await getOrders(visitor)).length, 1);
    assert.equal((await getCart(visitor)).length, 1);

    assert.equal((await getPaidOrder(randomUUID(), session)).status, 404);
  });
}

test('card payment checks the stock first, then takes it once paid without going below 0', async () => {
  const product = await createProduct({ ...newProduct, stock: 3 });
  const visitorId = randomUUID();
  assert.equal((await addProduct(visitorId, product.id, 2)).status, 201);
  const session = await startCheckout(visitorId);

  // Someone else buys 2 while this customer is on Stripe's page
  const otherVisitorId = randomUUID();
  await addProduct(otherVisitorId, product.id, 2);
  assert.equal((await placeOrder(otherVisitorId)).status, 201);
  assert.equal(await getStock(product.id), 1);
  const refused = await checkout(visitorId);
  assert.equal(refused.status, 409);
  assert.match((await refused.json()).error, /Only 1 of Plaid Wool Scarf left/);

  // The first session was paid anyway, so the order stands and the stock stops at 0
  session.payment_status = 'paid';
  assert.equal((await getPaidOrder(visitorId, session)).status, 200);
  assert.equal((await getOrders(visitorId)).length, 1);
  assert.equal(await getStock(product.id), 0);
  await deleteProduct(product);
});

test('cancelling a card order refunds the whole payment once, then gives back its stock', async () => {
  const product = await createProduct({ ...newProduct, stock: 5 });
  const { visitorId, session, order } = await placeCardOrder(product);
  assert.equal(await getStock(product.id), 4);

  const response = await cancelOrder(visitorId, order.id);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'cancelled');
  assert.equal(await getStock(product.id), 5);
  const [refund, ...more] = refundsFor(session);
  assert.deepEqual(more, []);
  // No amount, so Stripe refunds all of it
  assert.equal(refund.amount, undefined);
  assert.deepEqual(refund.metadata, { app: 'react-ecommerce', orderId: order.id });

  const again = await cancelOrder(visitorId, order.id);
  assert.equal(again.status, 409);
  assert.equal((await again.json()).error, 'This order is already cancelled.');
  assert.equal(refundsFor(session).length, 1);
  assert.equal(await getStock(product.id), 5);
  await deleteProduct(product);
});

test('a customer and an admin cancelling a card order at once refund it and give back its stock once', async () => {
  const product = await createProduct({ ...newProduct, stock: 5 });
  const { visitorId, session, order } = await placeCardOrder(product);

  const responses = await Promise.all([cancelOrder(visitorId, order.id), setOrderStatus(order.id, 'cancelled')]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(refundsFor(session).length, 1);
  assert.equal(await getStock(product.id), 5);
  await deleteProduct(product);
});

test('a card order stays as it was when Stripe refuses the refund', async () => {
  const product = await createProduct({ ...newProduct, stock: 5 });
  const { visitorId, session, order } = await placeCardOrder(product);

  setRefundError({ type: 'invalid_request_error', code: 'insufficient_funds', message: 'Insufficient funds in Stripe account.' });
  try {
    for (const response of [await cancelOrder(visitorId, order.id), await setOrderStatus(order.id, 'cancelled')]) {
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error, "The refund didn't go through, so the order wasn't cancelled. Please try again later.");
    }
  } finally {
    setRefundError(null);
  }
  assert.equal((await getOrders(visitorId))[0].status, 'processing');
  assert.equal(await getStock(product.id), 4);
  assert.deepEqual(refundsFor(session), []);

  // Once Stripe works again, cancelling does too
  assert.equal((await cancelOrder(visitorId, order.id)).status, 200);
  assert.equal(refundsFor(session).length, 1);
  await deleteProduct(product);
});

test("a card order whose payment isn't tagged for this store is not refunded", async () => {
  const product = await createProduct({ ...newProduct, stock: 5 });
  const { visitorId, session, order } = await placeCardOrder(product);
  session.metadata = { ...session.metadata, app: 'other-app' };

  const refused = await cancelOrder(visitorId, order.id);
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error, "This order's payment can't be refunded by the store.");
  assert.deepEqual(refundsFor(session), []);
  assert.equal((await getOrders(visitorId))[0].status, 'processing');
  assert.equal(await getStock(product.id), 4);
  await deleteProduct(product);
});

test('refuses webhooks without a valid Stripe signature', async () => {
  const visitorId = randomUUID();
  await addToCart(visitorId);
  const session = await startCheckout(visitorId);
  session.payment_status = 'paid';
  const event = checkoutCompleted(session);

  assert.equal((await sendWebhook(event, { secret: 'whsec_someone_else' })).status, 400);
  assert.equal((await sendWebhook(event, { body: JSON.stringify({ ...event, id: 'evt_changed' }) })).status, 400);
  const unsigned = await fetch(`${baseUrl}/api/stripe/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event)
  });
  assert.equal(unsigned.status, 400);

  assert.deepEqual(await getOrders(visitorId), []);
  assert.equal((await getCart(visitorId)).length, 1);
});

test('ignores Stripe events for sessions of the other app in the sandbox', async () => {
  const visitorId = randomUUID();
  await addToCart(visitorId);
  const session = await startCheckout(visitorId);
  session.payment_status = 'paid';

  for (const metadata of [{ app: 'other-app', visitorId }, { visitorId }, {}]) {
    const response = await sendWebhook(checkoutCompleted({ ...session, metadata }));
    assert.equal(response.status, 200, JSON.stringify(metadata));
  }
  assert.equal((await sendWebhook({ ...checkoutCompleted(session), type: 'payment_intent.succeeded' })).status, 200);
  assert.deepEqual(await getOrders(visitorId), []);
  assert.equal((await getCart(visitorId)).length, 1);

  // Nor does the success page take one
  session.metadata = { ...session.metadata, app: 'other-app' };
  assert.equal((await getPaidOrder(visitorId, session)).status, 404);
  assert.equal((await getPaidOrder(visitorId, { id: 'cs_test_missing' })).status, 404);
});

test('card payment is off without a Stripe test key, and paying on delivery still works', async () => {
  const { visitorId: cardCustomer, order: cardOrder } = await placeCardOrder({ id: productId });
  for (const STRIPE_SECRET_KEY of ['', 'sk_live_not_for_a_demo']) {
    await stopServer();
    await startServer({ STRIPE_SECRET_KEY });

    // An earlier card order can't be refunded, so it can't be cancelled either
    const { orders } = await getAdminOrders('?paymentMethod=card');
    assert.deepEqual(orders.find(({ id }) => id === cardOrder.id).nextStatuses, ['shipped']);
    const refused = await cancelOrder(cardCustomer, cardOrder.id);
    assert.equal(refused.status, 409);
    assert.match((await refused.json()).error, /can't be refunded right now/);

    assert.deepEqual(await (await api('/api/stripe/config')).json(), { cardPayment: false }, STRIPE_SECRET_KEY);
    const visitorId = randomUUID();
    await addToCart(visitorId);
    assert.equal((await checkout(visitorId)).status, 404);
    assert.equal((await sendWebhook(checkoutCompleted({ id: 'cs_test_off', metadata: {} }))).status, 404);
    assert.equal((await api('/api/orders', { visitorId, method: 'POST' })).status, 201);
  }

  await stopServer();
  await startServer();
  assert.deepEqual(await (await api('/api/stripe/config')).json(), { cardPayment: true });
});
