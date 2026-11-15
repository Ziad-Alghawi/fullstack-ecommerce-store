import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const serverFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.js');
// The database file is saved in the working directory, so use an empty
// folder to keep the real database.sqlite untouched
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-backend-test-'));
const productId = 'e43638ce-6aa0-4b85-b27f-e1d07eb678c6';
const adminId = randomUUID();
const newProduct = {
  name: 'Plaid Wool Scarf',
  priceCents: 1599,
  image: 'images/products/gray-hand-knit-wool-socks.jpg',
  keywords: ['scarves', 'plaid'],
  category: 'Accessories',
  stock: 25
};

const newCoupon = { code: 'spring25', percentOff: 25, expiresAt: '2099-06-30T23:59:59.000Z', active: true, featured: false };

let server;
let baseUrl;
let supabase;
let supabaseUrl;
let signingKey;
let stripeApi;
let stripeSettings;
const webhookSecret = 'whsec_test_secret';
// The Checkout Sessions the server created, by ID, and their line items
const stripeSessions = new Map();
const stripeLineItems = new Map();
const stripeCoupons = new Map();
// The refunds the server asked for, by idempotency key. Tests set refundError to make Stripe refuse the next ones
const stripeRefunds = new Map();
let refundError = null;

function getFreePort() {
  return new Promise((resolve) => {
    const probe = net.createServer().listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// Stands in for Supabase Auth, which publishes the public keys its tokens are signed with
async function startSupabase() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  signingKey = privateKey;
  const keys = { keys: [{ ...await exportJWK(publicKey), kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  supabase = http.createServer((req, res) => {
    if (req.url !== '/auth/v1/.well-known/jwks.json') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(keys));
  });
  await new Promise((resolve) => supabase.listen(0, resolve));
  supabaseUrl = `http://localhost:${supabase.address().port}`;
}

// Stripe's API takes form fields like line_items[0][price_data][unit_amount]=1090
function parseStripeForm(body) {
  const fields = {};
  for (const [name, value] of new URLSearchParams(body)) {
    const keys = name.split(/\]?\[|\]/).filter(Boolean);
    const parent = keys.slice(0, -1).reduce((object, key) => (object[key] ??= {}), fields);
    parent[keys.at(-1)] = value;
  }
  return fields;
}

// Stands in for the Stripe API. It keeps the sessions the server creates, which tests then mark paid
async function startStripe() {
  stripeApi = http.createServer(async (req, res) => {
    const send = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
    const [, sessionId, lineItemsPath] = req.url.match(/^\/v1\/checkout\/sessions(?:\/(\w+)(\/line_items)?)?/) ?? [];

    let body = '';
    for await (const chunk of req) body += chunk;

    if (req.method === 'POST' && req.url === '/v1/coupons') {
      const fields = parseStripeForm(body);
      const coupon = { ...fields, id: `coupon_${randomUUID().replaceAll('-', '')}`, object: 'coupon', amount_off: Number(fields.amount_off) };
      stripeCoupons.set(coupon.id, coupon);
      return send(200, coupon);
    }

    if (req.method === 'POST' && req.url === '/v1/refunds') {
      if (refundError) {
        return send(402, { error: refundError });
      }
      // Like Stripe, a repeated idempotency key gets the first refund back instead of a new one
      const key = req.headers['idempotency-key'];
      if (!stripeRefunds.has(key)) {
        const fields = parseStripeForm(body);
        stripeRefunds.set(key, { ...fields, id: `re_${randomUUID().replaceAll('-', '')}`, object: 'refund', status: 'succeeded' });
      }
      return send(200, stripeRefunds.get(key));
    }

    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      const { line_items: lines, metadata, success_url, cancel_url, discounts } = parseStripeForm(body);

      const lineItems = Object.values(lines).map(({ price_data: price, quantity }) => ({
        description: price.product_data.name,
        quantity: Number(quantity),
        amount_total: Number(price.unit_amount) * Number(quantity),
        price: { currency: price.currency, unit_amount: Number(price.unit_amount), product: { metadata: price.product_data.metadata ?? {} } }
      }));
      const session = {
        id: `cs_test_${randomUUID().replaceAll('-', '')}`,
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/test',
        amount_total: lineItems.reduce((total, line) => total + line.amount_total, 0)
          - Object.values(discounts ?? {}).reduce((total, { coupon }) => total + stripeCoupons.get(coupon).amount_off, 0),
        payment_status: 'unpaid',
        payment_intent: `pi_${randomUUID().replaceAll('-', '')}`,
        metadata,
        success_url,
        cancel_url
      };
      stripeSessions.set(session.id, session);
      stripeLineItems.set(session.id, lineItems);
      return send(200, session);
    }

    if (req.method === 'GET' && stripeSessions.has(sessionId) && lineItemsPath) {
      // Takes a moment like the real API, so requests that arrive together overlap
      setTimeout(() => send(200, { object: 'list', data: stripeLineItems.get(sessionId), has_more: false }), 50);
      return;
    }
    if (req.method === 'GET' && stripeSessions.has(sessionId)) {
      return send(200, stripeSessions.get(sessionId));
    }
    send(404, { error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such checkout session' } });
  });
  await new Promise((resolve) => stripeApi.listen(0, resolve));
  stripeSettings = {
    STRIPE_SECRET_KEY: 'sk_test_stand_in',
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_API_URL: `http://localhost:${stripeApi.address().port}`
  };
}

function createToken(userId = randomUUID(), {
  key = signingKey,
  issuer = `${supabaseUrl}/auth/v1`,
  expiresAt = '1h',
  email
} = {}) {
  return new SignJWT({ role: 'authenticated', email })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setSubject(userId)
    .setExpirationTime(expiresAt)
    .sign(key);
}

async function startServer(settings = {}) {
  const port = await getFreePort();
  baseUrl = `http://localhost:${port}`;
  // Like a local run, the Supabase project only comes from .env. Real environment variables
  // win over the file, so the order limit tests see MAX_ORDERS=2
  fs.writeFileSync(path.join(workDir, '.env'), `SUPABASE_URL=${supabaseUrl}
MAX_ORDERS=50
`);
  const env = {
    ...process.env,
    PORT: String(port),
    MAX_VISITORS: '3',
    MAX_ORDERS: '2',
    // The tests make far more requests from one address than a customer would
    RATE_LIMIT_SCALE: '100',
    // Spaces and capitals as someone might paste them
    ADMIN_USER_IDS: ` ${adminId.toUpperCase()} ,${randomUUID()}`,
    // Tests delete visitors, so they only reach Postgres when given a throwaway database
    DATABASE_URL: process.env.TEST_DATABASE_URL || '',
    ...stripeSettings,
    ...settings
  };
  delete env.SUPABASE_URL;

  server = spawn(process.execPath, [serverFile], { cwd: workDir, env });

  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Server is running')) resolve();
    });
    server.on('exit', (code) => reject(new Error(`Server exited with code ${code}`)));
  });
}

async function stopServer() {
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill();
  await exited;
}

// A guest is their visitor ID. A logged in user is { token }, plus the browser's visitorId if any
function api(urlPath, {
  visitorId, token, authorization = token && `Bearer ${token}`, method = 'GET', body, headers: extraHeaders
} = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (visitorId) headers['X-Visitor-Id'] = visitorId;
  if (authorization) headers.Authorization = authorization;
  return fetch(baseUrl + urlPath, {
    method,
    headers,
    body: body && JSON.stringify(body)
  });
}

const identify = (who) => (typeof who === 'string' ? { visitorId: who } : who);

async function addToCart(who) {
  const response = await api('/api/cart-items', {
    ...identify(who), method: 'POST', body: { productId, quantity: 1 }
  });
  assert.equal(response.status, 201);
}

async function getCart(who) {
  return (await api('/api/cart-items', identify(who))).json();
}

async function asAdmin() {
  return { token: await createToken(adminId) };
}

async function createProduct(fields = newProduct) {
  const response = await api('/api/admin/products', { ...await asAdmin(), method: 'POST', body: fields });
  assert.equal(response.status, 201);
  return response.json();
}

// A search word, or a query string starting with ?
async function getProducts(query = '') {
  const queryString = query.startsWith('?') || !query ? query : `?search=${query}`;
  return (await api(`/api/products${queryString}`)).json();
}

// A logged in user who has ordered the product, so they can review it
async function createBuyer(orderedProductId = productId, email) {
  const buyer = { token: await createToken(randomUUID(), { email }) };
  await api('/api/cart-items', { ...buyer, method: 'POST', body: { productId: orderedProductId, quantity: 1 } });
  assert.equal((await api('/api/orders', { ...buyer, method: 'POST' })).status, 201);
  return buyer;
}

const reviewsPath = (id = productId) => `/api/products/${id}/reviews`;

function postReview(who, body, id = productId) {
  return api(reviewsPath(id), { ...who, method: 'POST', body });
}

async function getReviews(who = {}, id = productId) {
  return (await api(reviewsPath(id), who)).json();
}

async function getStock(id) {
  return (await (await api(`/api/products/${id}`)).json()).stock;
}

async function setStock(product, stock) {
  const response = await api(`/api/admin/products/${product.id}`, {
    ...await asAdmin(), method: 'PUT', body: { ...newProduct, name: product.name, stock }
  });
  assert.equal(response.status, 200);
}

function addProduct(who, id, quantity = 1) {
  return api('/api/cart-items', { ...identify(who), method: 'POST', body: { productId: id, quantity } });
}

function placeOrder(who) {
  return api('/api/orders', { ...identify(who), method: 'POST' });
}

async function deleteProduct(product) {
  await api(`/api/admin/products/${product.id}`, { ...await asAdmin(), method: 'DELETE' });
}

async function getRating(id) {
  return (await (await api(`/api/products/${id}`)).json()).rating;
}

async function getOrders(who) {
  return (await api('/api/orders', identify(who))).json();
}

function checkout(who, origin = baseUrl) {
  return api('/api/stripe/checkout-sessions', { ...identify(who), method: 'POST', headers: { Origin: origin } });
}

// What clicking Pay with card does. Returns the session the Stripe stand-in got
async function startCheckout(who) {
  const response = await checkout(who);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).url, 'https://checkout.stripe.com/c/pay/test');
  return [...stripeSessions.values()].at(-1);
}

// What the success page asks for after Stripe sends the customer back
function getPaidOrder(who, session) {
  return api(`/api/stripe/checkout-sessions/${session.id}/order`, identify(who));
}

// Signed like Stripe signs webhooks: an HMAC of the timestamp and the exact body
function sendWebhook(event, { secret = webhookSecret, body = JSON.stringify(event) } = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${JSON.stringify(event)}`).digest('hex');
  return fetch(`${baseUrl}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
    body
  });
}

function checkoutCompleted(session) {
  return { id: `evt_${randomUUID()}`, object: 'event', type: 'checkout.session.completed', data: { object: session } };
}

before(async () => {
  await startSupabase();
  await startStripe();
  await startServer();
});
after(async () => {
  await stopServer();
  supabase.close();
  stripeApi.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

test('products and delivery options work without a visitor ID', async () => {
  assert.equal((await api('/api/products')).status, 200);
  assert.equal((await api('/api/delivery-options')).status, 200);
});

test('searches products by name or keyword', async () => {
  const byName = await (await api('/api/products?search=SOCKS')).json();
  assert.ok(byName.some((product) => product.id === productId));

  const byKeyword = await (await api('/api/products?search=apparel')).json();
  assert.ok(byKeyword.some((product) => product.id === productId));

  assert.deepEqual(await (await api('/api/products?search=spaceship')).json(), []);
});

test('lists the categories, and every demo product is in one of them', async () => {
  const categories = await (await api('/api/products/categories')).json();
  assert.deepEqual(categories, ['Home & Kitchen', 'Clothing', 'Shoes', 'Accessories', 'Sports']);
  for (const product of await getProducts()) {
    assert.ok(categories.includes(product.category), product.name);
  }
});

test('filters products by category and price, together with search', async () => {
  const clothing = await getProducts('?category=Clothing');
  assert.ok(clothing.length > 0);
  assert.ok(clothing.every(({ category }) => category === 'Clothing'));
  assert.ok(clothing.some(({ id }) => id === productId));

  const kitchen = await getProducts(`?category=${encodeURIComponent('Home & Kitchen')}`);
  assert.ok(kitchen.length > 0 && kitchen.every(({ category }) => category === 'Home & Kitchen'));
  assert.deepEqual(await getProducts('?category=Spaceships'), []);

  const affordable = await getProducts('?minPriceCents=1000&maxPriceCents=2000');
  assert.ok(affordable.length > 0);
  assert.ok(affordable.every(({ priceCents }) => priceCents >= 1000 && priceCents <= 2000));
  // Socks cost €10.90
  assert.deepEqual((await getProducts('?minPriceCents=1090&maxPriceCents=1090')).map(({ id }) => id), [productId]);
  assert.ok((await getProducts('?minPriceCents=5000')).every(({ priceCents }) => priceCents >= 5000));

  const clothingSearch = await getProducts('?search=sweater&category=Clothing&maxPriceCents=2500');
  assert.ok(clothingSearch.length > 0);
  assert.ok(clothingSearch.every(({ name, category, priceCents }) => (
    /sweater/i.test(name) && category === 'Clothing' && priceCents <= 2500
  )));
});

test('sorts products by price, rating or newest', async () => {
  const all = await getProducts();
  const byPrice = await getProducts('?sort=price-asc');
  assert.equal(byPrice.length, all.length);
  assert.deepEqual(byPrice.map(({ priceCents }) => priceCents), all.map(({ priceCents }) => priceCents).sort((a, b) => a - b));
  assert.deepEqual((await getProducts('?sort=price-desc')).map(({ priceCents }) => priceCents),
    byPrice.map(({ priceCents }) => priceCents).reverse());

  const byRating = await getProducts('?sort=rating');
  for (const [higher, lower] of byRating.slice(1).map((product, index) => [byRating[index], product])) {
    assert.ok(higher.rating.stars > lower.rating.stars
      || (higher.rating.stars === lower.rating.stars && higher.rating.count >= lower.rating.count));
  }

  const product = await createProduct();
  assert.equal((await getProducts('?sort=newest'))[0].id, product.id);
  assert.equal((await getProducts('?category=Accessories&sort=newest'))[0].id, product.id);
  await api(`/api/admin/products/${product.id}`, { ...await asAdmin(), method: 'DELETE' });
});

test('refuses an unknown sort or a price that is not whole cents', async () => {
  for (const query of ['sort=cheapest', 'minPriceCents=10.5', 'maxPriceCents=-1', 'minPriceCents=ten', 'sort=rating&sort=newest']) {
    const response = await api(`/api/products?${query}`);
    assert.equal(response.status, 400, query);
    assert.ok((await response.json()).error, query);
  }
});

test('an order costs what the payment summary showed', async () => {
  const visitorId = randomUUID();
  await addToCart(visitorId);
  await api(`/api/cart-items/${productId}`, {
    visitorId, method: 'PUT', body: { quantity: 2, deliveryOptionId: '2' }
  });

  const summary = await (await api('/api/payment-summary', { visitorId })).json();
  // 2 socks at €10.90, €4.99 shipping, 10% tax
  assert.equal(summary.totalItems, 2);
  assert.equal(summary.productCostCents, 2180);
  assert.equal(summary.shippingCostCents, 499);
  assert.equal(summary.taxCents, 268);
  assert.equal(summary.totalCostCents, 2947);

  const order = await (await api('/api/orders', { visitorId, method: 'POST' })).json();
  assert.equal(order.totalCostCents, summary.totalCostCents);

  // Delivery option 2 takes 3 days
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const deliveryTimeMs = order.products[0].estimatedDeliveryTimeMs;
  assert.ok(Math.abs(deliveryTimeMs - (order.orderTimeMs + threeDaysMs)) < 5000);

  const savedOrder = await (await api(`/api/orders/${order.id}?expand=products`, { visitorId })).json();
  assert.equal(savedOrder.products[0].product.id, productId);
  assert.equal(savedOrder.orderTimeMs, order.orderTimeMs);
});

for (const [kind, createVisitor] of [
  ['guest', async () => randomUUID()],
  ['user', async () => ({ token: await createToken() })]
]) {
  test(`refuses new orders once a ${kind} has reached the limit`, async () => {
    // The server was started with room for 2 orders per visitor
    const visitor = await createVisitor();
    const placeOrder = () => api('/api/orders', { ...identify(visitor), method: 'POST' });

    for (let i = 0; i < 2; i++) {
      await addToCart(visitor);
      assert.equal((await placeOrder()).status, 201);
    }

    await addToCart(visitor);
    const response = await placeOrder();
    assert.equal(response.status, 409);
    const refusal = await response.json();
    assert.match(refusal.error, /up to 2 orders/);
    assert.equal(refusal.code, 'orderLimit');
    assert.deepEqual(refusal.params, { max: 2 });
    // The cart is kept, so nothing is lost
    assert.equal((await getCart(visitor)).length, 1);
  });
}

test('cart and order routes need a valid visitor ID', async () => {
  for (const urlPath of ['/api/cart-items', '/api/orders', '/api/payment-summary']) {
    assert.equal((await api(urlPath)).status, 400, `${urlPath} without an ID`);
    assert.equal((await api(urlPath, { visitorId: 'not-a-uuid' })).status, 400, `${urlPath} with a bad ID`);
  }
});

test('reads the Supabase project from .env in the folder it runs in', async () => {
  const response = await api('/api/cart-items', { token: await createToken() });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});

test('a logged in user has the same cart and orders in every browser', async () => {
  const token = await createToken();
  const laptop = { token, visitorId: randomUUID() };
  const phone = { token, visitorId: randomUUID() };

  await addToCart(laptop);
  assert.equal((await getCart(phone)).length, 1);
  // No visitor ID is needed with a token
  assert.equal((await getCart({ token })).length, 1);
  // The browser's own guest cart is separate
  assert.deepEqual(await getCart(laptop.visitorId), []);

  const order = await (await api('/api/orders', { ...phone, method: 'POST' })).json();
  assert.equal((await api(`/api/orders/${order.id}`, { token })).status, 200);
  assert.equal((await api(`/api/orders/${order.id}`, { token: await createToken() })).status, 404);
});

test("a user's ID sent as a guest's visitor ID can't open their cart", async () => {
  const userId = randomUUID();
  await addToCart({ token: await createToken(userId) });

  const response = await api('/api/cart-items', { visitorId: userId.toUpperCase() });
  assert.equal(response.status, 401);
});

test('logging in moves the guest cart and orders to the account', async () => {
  const guestId = randomUUID();
  const token = await createToken();
  const otherProductId = '15b6fc6f-327a-4ec4-896f-486349e85a3d';

  await addToCart(guestId);
  const order = await (await api('/api/orders', { visitorId: guestId, method: 'POST' })).json();
  await addToCart(guestId);
  await api('/api/cart-items', {
    visitorId: guestId, method: 'POST', body: { productId: otherProductId, quantity: 2 }
  });
  // Already in the account's cart from another device
  await addToCart({ token });

  // The first requests after logging in arrive together
  const [cart] = await Promise.all([
    getCart({ token, visitorId: guestId }),
    getCart({ token, visitorId: guestId })
  ]);

  const quantities = Object.fromEntries(cart.map((item) => [item.productId, item.quantity]));
  assert.deepEqual(quantities, { [productId]: 2, [otherProductId]: 2 });
  const orders = await (await api('/api/orders', { token })).json();
  assert.deepEqual(orders.map(({ id }) => id), [order.id]);

  // Nothing is left for the guest, and nothing moves twice
  assert.deepEqual(await getCart(guestId), []);
  assert.deepEqual(await (await api('/api/orders', { visitorId: guestId })).json(), []);
  assert.deepEqual(await getCart({ token, visitorId: guestId }), cart);
});

test('a guest who logs out and in again keeps what they added in between', async () => {
  const guestId = randomUUID();
  const token = await createToken();

  await addToCart({ token, visitorId: guestId });
  await addToCart(guestId);

  assert.equal((await getCart({ token, visitorId: guestId }))[0].quantity, 2);
});

test('an invalid or expired token is refused, even with a visitor ID', async () => {
  const userId = randomUUID();
  const { privateKey: otherKey } = await generateKeyPair('ES256');
  const badAuthorizations = {
    'that is not a JWT': 'Bearer not-a-token',
    'without Bearer': `Basic ${await createToken(userId)}`,
    'signed with another key': `Bearer ${await createToken(userId, { key: otherKey })}`,
    'from another project': `Bearer ${await createToken(userId, { issuer: 'https://other.supabase.co/auth/v1' })}`,
    'that has expired': `Bearer ${await createToken(userId, { expiresAt: Math.floor(Date.now() / 1000) - 60 })}`,
    'for a user ID that is not a UUID': `Bearer ${await createToken('not-a-uuid')}`
  };

  for (const [problem, authorization] of Object.entries(badAuthorizations)) {
    for (const urlPath of ['/api/cart-items', '/api/orders', '/api/payment-summary']) {
      const response = await api(urlPath, { authorization, visitorId: randomUUID() });
      assert.equal(response.status, 401, `${urlPath} with a token ${problem}`);
      assert.match((await response.json()).error, /log in again/);
    }
  }
});

test('malformed product and order IDs are not found', async () => {
  const visitorId = randomUUID();
  const addResponse = await api('/api/cart-items', {
    visitorId, method: 'POST', body: { productId: 'not-a-uuid', quantity: 1 }
  });
  assert.equal(addResponse.status, 400);

  for (const method of ['PUT', 'DELETE']) {
    const response = await api('/api/cart-items/not-a-uuid', { visitorId, method, body: { quantity: 1 } });
    assert.equal(response.status, 404, `${method} a cart item`);
  }
  assert.equal((await api('/api/orders/not-a-uuid', { visitorId })).status, 404);
});

test('a failing database call returns a 500 error and the server keeps running', async () => {
  const visitorId = randomUUID();
  await addToCart(visitorId);

  // Sequelize throws when findByPk gets an object instead of an ID
  const response = await api(`/api/cart-items/${productId}`, {
    visitorId, method: 'PUT', body: { deliveryOptionId: {} }
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Something went wrong!' });

  assert.equal((await api('/api/products')).status, 200);
});

test('a malformed JSON body returns a 400 error', async () => {
  const response = await fetch(`${baseUrl}/api/cart-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': randomUUID() },
    body: '{ "productId": '
  });
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error);
});

test('new visitors start with an empty cart and no orders', async () => {
  const visitorId = randomUUID();
  assert.deepEqual(await getCart(visitorId), []);
  assert.deepEqual(await (await api('/api/orders', { visitorId })).json(), []);
});

test('each visitor has their own cart and orders', async () => {
  const alice = randomUUID();
  const bob = randomUUID();

  await addToCart(alice);
  assert.equal((await getCart(alice)).length, 1);
  assert.deepEqual(await getCart(bob), []);

  const summary = await (await api('/api/payment-summary', { visitorId: bob })).json();
  assert.equal(summary.totalItems, 0);

  const order = await (await api('/api/orders', { visitorId: alice, method: 'POST' })).json();
  assert.deepEqual(await getCart(alice), []);
  assert.equal((await (await api('/api/orders', { visitorId: alice })).json()).length, 1);
  assert.deepEqual(await (await api('/api/orders', { visitorId: bob })).json(), []);

  // Bob can't open Alice's order, even with its ID
  assert.equal((await api(`/api/orders/${order.id}`, { visitorId: alice })).status, 200);
  assert.equal((await api(`/api/orders/${order.id}`, { visitorId: bob })).status, 404);
});

test('tells the frontend whether the user is an admin, from the token only', async () => {
  const userId = randomUUID();
  const me = async (who) => (await api('/api/me', who)).json();

  assert.deepEqual(await me({}), { userId: null, isAdmin: false });
  assert.deepEqual(await me({ visitorId: adminId }), { userId: null, isAdmin: false });
  assert.deepEqual(await me({ token: await createToken(userId) }), { userId, isAdmin: false });
  assert.deepEqual(await me(await asAdmin()), { userId: adminId, isAdmin: true });

  const expired = await createToken(adminId, { expiresAt: Math.floor(Date.now() / 1000) - 60 });
  assert.equal((await api('/api/me', { token: expired })).status, 401);
});

test("admin routes need an admin's valid token", async () => {
  const routes = [
    ['GET', '/api/admin/images'],
    ['POST', '/api/admin/products', newProduct],
    ['PUT', `/api/admin/products/${productId}`, newProduct],
    ['DELETE', `/api/admin/products/${productId}`],
    ['GET', '/api/admin/coupons'],
    ['POST', '/api/admin/coupons', newCoupon],
    ['PUT', `/api/admin/coupons/${randomUUID()}`, newCoupon],
    ['GET', '/api/admin/orders'],
    ['PATCH', `/api/admin/orders/${randomUUID()}`, { status: 'shipped' }],
    ['GET', '/api/admin/stats']
  ];
  const refusals = [
    ['without a token', {}, 401],
    ["with the admin's ID as a visitor ID", { visitorId: adminId }, 401],
    ["with an admin's token from another project", {
      token: await createToken(adminId, { issuer: 'https://other.supabase.co/auth/v1' })
    }, 401],
    ["with a user's token", { token: await createToken() }, 403]
  ];

  for (const [method, urlPath, body] of routes) {
    for (const [problem, who, status] of refusals) {
      const response = await api(urlPath, { ...who, method, body });
      assert.equal(response.status, status, `${method} ${urlPath} ${problem}`);
      assert.ok((await response.json()).error);
    }
  }
  assert.equal((await getProducts()).find(({ id }) => id === productId).name, 'Gray Hand Knit Wool Socks');

  const response = await api('/api/admin/images', await asAdmin());
  assert.equal(response.status, 200);
  const images = await response.json();
  assert.equal(images.length, 42);
  assert.ok(images.includes(newProduct.image));
});

test('an admin adds, edits and deletes a product', async () => {
  const admin = await asAdmin();
  const product = await createProduct({
    ...newProduct,
    name: `  ${newProduct.name}  `,
    keywords: [' scarves', 'plaid '],
    rating: { stars: 5, count: 1000 }
  });
  assert.equal(product.name, newProduct.name);
  assert.deepEqual(product.keywords, newProduct.keywords);
  assert.equal(product.category, newProduct.category);
  assert.equal(product.stock, newProduct.stock);
  assert.deepEqual(product.rating, { stars: 0, count: 0 });
  assert.deepEqual((await getProducts('plaid')).map(({ id }) => id), [product.id]);

  const changes = { ...newProduct, name: 'Cashmere Scarf', priceCents: 1299, keywords: [], category: 'Clothing', stock: 0, rating: { stars: 5, count: 1 } };
  const updateResponse = await api(`/api/admin/products/${product.id}`, { ...admin, method: 'PUT', body: changes });
  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json();
  assert.equal(updated.name, 'Cashmere Scarf');
  assert.equal(updated.priceCents, 1299);
  assert.deepEqual(updated.keywords, []);
  assert.equal(updated.category, 'Clothing');
  assert.equal(updated.stock, 0);
  assert.deepEqual(updated.rating, { stars: 0, count: 0 });
  assert.deepEqual((await getProducts('cashmere')).map(({ id }) => id), [product.id]);

  const deleteResponse = await api(`/api/admin/products/${product.id}`, { ...admin, method: 'DELETE' });
  assert.equal(deleteResponse.status, 204);
  assert.ok(!(await getProducts()).some(({ id }) => id === product.id));
  assert.deepEqual(await getProducts('cashmere'), []);

  for (const id of [product.id, randomUUID(), 'not-a-uuid']) {
    for (const method of ['PUT', 'DELETE']) {
      const response = await api(`/api/admin/products/${id}`, { ...admin, method, body: newProduct });
      assert.equal(response.status, 404, `${method} ${id}`);
    }
  }
});

test('refuses product fields that are missing or invalid', async () => {
  const admin = await asAdmin();
  const product = await createProduct();
  const invalidFields = {
    'without a name': { name: undefined },
    'with a blank name': { name: '   ' },
    'with a name over 100 characters': { name: 'a'.repeat(101) },
    'without a price': { priceCents: undefined },
    'with a price of 0': { priceCents: 0 },
    'with a negative price': { priceCents: -100 },
    'with a price in euros, not cents': { priceCents: 15.99 },
    'with a price as text': { priceCents: '1599' },
    'with a price over €10,000': { priceCents: 1000001 },
    'without an image': { image: undefined },
    'with an image from another site': { image: 'https://example.com/hat.jpg' },
    'without keywords': { keywords: undefined },
    'with keywords as text': { keywords: 'scarves,plaid' },
    'with a keyword containing a comma': { keywords: ['scarves,shawls'] },
    'with a blank keyword': { keywords: [' '] },
    'with a keyword over 20 characters': { keywords: ['k'.repeat(21)] },
    'with more than 10 keywords': { keywords: Array.from({ length: 11 }, (_, i) => `keyword${i}`) },
    'without a category': { category: undefined },
    'without stock': { stock: undefined },
    'with negative stock': { stock: -1 },
    'with stock that is not whole': { stock: 2.5 },
    'with stock as text': { stock: '10' },
    'with stock over 100,000': { stock: 100001 },
    'with an unknown category': { category: 'Spaceships' }
  };

  for (const [problem, fields] of Object.entries(invalidFields)) {
    const body = { ...newProduct, ...fields };
    const createResponse = await api('/api/admin/products', { ...admin, method: 'POST', body });
    assert.equal(createResponse.status, 400, `creating a product ${problem}`);
    assert.ok((await createResponse.json()).error);

    const updateResponse = await api(`/api/admin/products/${product.id}`, { ...admin, method: 'PUT', body });
    assert.equal(updateResponse.status, 400, `editing a product ${problem}`);
  }

  assert.deepEqual((await getProducts('plaid')).map(({ id }) => id), [product.id]);
  assert.equal((await getProducts('plaid'))[0].name, newProduct.name);
  await api(`/api/admin/products/${product.id}`, { ...admin, method: 'DELETE' });
});

test('the cart holds no more of a product than is in stock', async () => {
  const product = await createProduct({ ...newProduct, stock: 3 });
  const visitorId = randomUUID();

  assert.equal((await addProduct(visitorId, product.id, 2)).status, 201);
  const tooMany = await addProduct(visitorId, product.id, 2);
  assert.equal(tooMany.status, 409);
  // The code and values let the store say it in the visitor's language
  assert.deepEqual(await tooMany.json(), {
    error: 'Only 3 of Plaid Wool Scarf left in stock. You already have 2 in your cart.',
    code: 'lowStock',
    params: { product: 'Plaid Wool Scarf', stock: 3, inCart: 2 }
  });
  assert.equal((await getCart(visitorId))[0].quantity, 2);

  const updatePath = `/api/cart-items/${product.id}`;
  assert.equal((await api(updatePath, { visitorId, method: 'PUT', body: { quantity: 4 } })).status, 409);
  assert.equal((await api(updatePath, { visitorId, method: 'PUT', body: { quantity: 3 } })).status, 200);

  await setStock(product, 0);
  const soldOut = await addProduct(randomUUID(), product.id);
  assert.equal(soldOut.status, 409);
  assert.deepEqual(await soldOut.json(), {
    error: 'Plaid Wool Scarf is out of stock.',
    code: 'outOfStock',
    params: { product: 'Plaid Wool Scarf', inCart: 0 }
  });
  // Lowering the quantity always works
  await setStock(product, 1);
  assert.equal((await api(updatePath, { visitorId, method: 'PUT', body: { quantity: 1 } })).status, 200);
  await deleteProduct(product);
});

test('placing an order takes its items out of stock, all or none', async () => {
  const scarf = await createProduct({ ...newProduct, stock: 5 });
  const hat = await createProduct({ ...newProduct, name: 'Wool Hat', stock: 1 });
  const visitorId = randomUUID();
  await addProduct(visitorId, scarf.id, 2);
  await addProduct(visitorId, hat.id, 1);

  // The hat sells out after it went in the cart
  await setStock(hat, 0);
  const refused = await placeOrder(visitorId);
  assert.equal(refused.status, 409);
  assert.deepEqual(await refused.json(), {
    error: 'Wool Hat is out of stock. Remove it from your cart to continue.',
    code: 'outOfStockInOrder',
    params: { product: 'Wool Hat' }
  });
  assert.equal(await getStock(scarf.id), 5);
  assert.deepEqual(await getOrders(visitorId), []);
  assert.equal((await getCart(visitorId)).length, 2);

  await api(`/api/cart-items/${hat.id}`, { visitorId, method: 'DELETE' });
  assert.equal((await placeOrder(visitorId)).status, 201);
  assert.equal(await getStock(scarf.id), 3);
  await deleteProduct(scarf);
  await deleteProduct(hat);
});

test('two orders at once cannot both take the last one', async () => {
  const product = await createProduct({ ...newProduct, stock: 1 });
  const visitors = [randomUUID(), randomUUID()];
  for (const visitorId of visitors) {
    assert.equal((await addProduct(visitorId, product.id)).status, 201);
  }

  const responses = await Promise.all(visitors.map(placeOrder));
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  assert.equal(await getStock(product.id), 0);
  await deleteProduct(product);
});

function cancelOrder(who, orderId) {
  return api(`/api/orders/${orderId}/cancel`, { ...identify(who), method: 'POST' });
}

test('a customer cancels an order paid on delivery before it ships, which gives back its stock', async () => {
  const product = await createProduct({ ...newProduct, stock: 5 });
  const visitorId = randomUUID();
  await addProduct(visitorId, product.id, 2);
  const order = await (await placeOrder(visitorId)).json();
  assert.equal(order.status, 'processing');
  assert.equal(await getStock(product.id), 3);

  // Another visitor's order is not found, like one that doesn't exist
  assert.equal((await cancelOrder(randomUUID(), order.id)).status, 404);

  const response = await cancelOrder(visitorId, order.id);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'cancelled');
  assert.equal((await getOrders(visitorId))[0].status, 'cancelled');
  assert.equal(await getStock(product.id), 5);

  const again = await cancelOrder(visitorId, order.id);
  assert.equal(again.status, 409);
  assert.deepEqual(await again.json(), { error: 'This order is already cancelled.', code: 'orderFinal', params: { status: 'cancelled' } });
  assert.equal(await getStock(product.id), 5);
  await deleteProduct(product);
});

test('two cancels at once give the stock back once', async () => {
  const product = await createProduct({ ...newProduct, stock: 5 });
  const visitorId = randomUUID();
  await addProduct(visitorId, product.id, 2);
  const order = await (await placeOrder(visitorId)).json();

  const responses = await Promise.all([cancelOrder(visitorId, order.id), cancelOrder(visitorId, order.id)]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(await getStock(product.id), 5);
  await deleteProduct(product);
});

// A card order of one Plaid Wool Scarf, paid and created like the success page does
async function placeCardOrder(product, visitorId = randomUUID()) {
  await addProduct(visitorId, product.id);
  const session = await startCheckout(visitorId);
  session.payment_status = 'paid';
  const order = await (await getPaidOrder(visitorId, session)).json();
  return { visitorId, session, order };
}

function refundsFor(session) {
  return [...stripeRefunds.values()].filter(({ payment_intent }) => payment_intent === session.payment_intent);
}

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

  refundError = { type: 'invalid_request_error', code: 'insufficient_funds', message: 'Insufficient funds in Stripe account.' };
  try {
    for (const response of [await cancelOrder(visitorId, order.id), await setOrderStatus(order.id, 'cancelled')]) {
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error, "The refund didn't go through, so the order wasn't cancelled. Please try again later.");
    }
  } finally {
    refundError = null;
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

async function getAdminOrders(query = '') {
  const response = await api(`/api/admin/orders${query}`, await asAdmin());
  assert.equal(response.status, 200);
  return response.json();
}

async function setOrderStatus(orderId, status) {
  return api(`/api/admin/orders/${orderId}`, { ...await asAdmin(), method: 'PATCH', body: { status } });
}

test('an admin lists the newest orders with a masked customer, and filters them', async () => {
  const guestId = randomUUID();
  await addToCart(guestId);
  const guestOrder = await (await placeOrder(guestId)).json();

  const customer = { token: await createToken(randomUUID(), { email: 'mary.major@example.com' }) };
  await addProduct(customer, productId, 3);
  const customerOrder = await (await placeOrder(customer)).json();

  const cardCustomer = { token: await createToken(randomUUID(), { email: 'card.holder@example.com' }) };
  await addToCart(cardCustomer);
  const session = await startCheckout(cardCustomer);
  session.payment_status = 'paid';
  const cardOrder = await (await getPaidOrder(cardCustomer, session)).json();

  const { orders, total } = await getAdminOrders();
  assert.equal(total, orders.length);
  assert.deepEqual(orders.slice(0, 3).map(({ id }) => id), [cardOrder.id, customerOrder.id, guestOrder.id]);
  assert.deepEqual(orders[1], {
    id: customerOrder.id,
    orderTimeMs: customerOrder.orderTimeMs,
    customerName: 'ma***',
    items: [{ name: 'Gray Hand Knit Wool Socks', quantity: 3 }],
    totalCostCents: customerOrder.totalCostCents,
    paymentMethod: 'delivery',
    status: 'processing',
    nextStatuses: ['shipped', 'cancelled']
  });
  assert.equal(orders[0].customerName, 'ca***');
  assert.deepEqual(orders[0].nextStatuses, ['shipped', 'cancelled']);
  assert.equal(orders[2].customerName, 'Guest');
  assert.ok(!JSON.stringify(orders).includes('example.com'));
  assert.ok(!JSON.stringify(orders).includes(guestId));

  const cardOrders = await getAdminOrders('?paymentMethod=card');
  assert.ok(cardOrders.orders.some(({ id }) => id === cardOrder.id));
  assert.ok(cardOrders.orders.every(({ paymentMethod }) => paymentMethod === 'card'));
  await setOrderStatus(guestOrder.id, 'shipped');
  const shipped = await getAdminOrders('?status=shipped&paymentMethod=delivery');
  assert.deepEqual(shipped.orders.map(({ id }) => id), [guestOrder.id]);

  for (const query of ['?status=lost', '?paymentMethod=cash', '?status=shipped&status=delivered']) {
    const response = await api(`/api/admin/orders${query}`, await asAdmin());
    assert.equal(response.status, 400, query);
  }
});

test('an admin ships and delivers an order, or cancels it before it ships', async () => {
  const product = await createProduct({ ...newProduct, stock: 5 });
  const [shippedId, cancelledId] = [randomUUID(), randomUUID()];
  for (const visitorId of [shippedId, cancelledId]) {
    await addProduct(visitorId, product.id, 2);
    await placeOrder(visitorId);
  }
  const [toShip] = await getOrders(shippedId);
  const [toCancel] = await getOrders(cancelledId);
  assert.equal(await getStock(product.id), 1);

  const shipped = await setOrderStatus(toShip.id, 'shipped');
  assert.equal(shipped.status, 200);
  assert.deepEqual(await shipped.json().then(({ status, nextStatuses }) => ({ status, nextStatuses })),
    { status: 'shipped', nextStatuses: ['delivered'] });
  assert.equal((await getOrders(shippedId))[0].status, 'shipped');

  // Too late to cancel, for the customer and the admin
  assert.equal((await cancelOrder(shippedId, toShip.id)).status, 409);
  const refused = await setOrderStatus(toShip.id, 'cancelled');
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error, "A shipped order can't be marked cancelled.");
  assert.equal((await setOrderStatus(toShip.id, 'processing')).status, 409);
  assert.equal((await setOrderStatus(toShip.id, 'delivered')).status, 200);
  assert.equal((await setOrderStatus(toShip.id, 'shipped')).status, 409);

  assert.equal((await setOrderStatus(toCancel.id, 'lost')).status, 400);
  assert.equal((await setOrderStatus(randomUUID(), 'shipped')).status, 404);
  assert.equal((await setOrderStatus(toCancel.id, 'cancelled')).status, 200);
  assert.equal(await getStock(product.id), 3);
  await deleteProduct(product);
});

async function getStats() {
  const response = await api('/api/admin/stats', await asAdmin());
  assert.equal(response.status, 200);
  return response.json();
}

test('the admin overview counts recent orders and revenue, without cancelled sales', async () => {
  const before = await getStats();
  const product = await createProduct({ ...newProduct, name: 'Bestselling Scarf', stock: 100 });
  const orders = [];
  // Logged in, as guests can be dropped for the visitor limit, taking their orders with them
  for (const buyer of [{ token: await createToken() }, { token: await createToken() }]) {
    for (let i = 0; i < 3; i++) {
      await addProduct(buyer, product.id, 10);
    }
    orders.push(await (await placeOrder(buyer)).json());
  }

  const after = await getStats();
  assert.equal(after.ordersLastDay, before.ordersLastDay + 2);
  assert.equal(after.ordersLastWeek, before.ordersLastWeek + 2);
  assert.equal(after.revenueLastWeekCents, before.revenueLastWeekCents + orders[0].totalCostCents * 2);
  assert.ok(after.topProducts.length <= 5);
  assert.deepEqual(after.topProducts.find(({ id }) => id === product.id),
    { id: product.id, name: 'Bestselling Scarf', image: product.image, unitsSold: 60 });
  assert.deepEqual(after.topProducts.map(({ unitsSold }) => unitsSold),
    after.topProducts.map(({ unitsSold }) => unitsSold).sort((a, b) => b - a));

  await setOrderStatus(orders[1].id, 'cancelled');
  const cancelled = await getStats();
  assert.equal(cancelled.ordersLastDay, before.ordersLastDay + 2);
  assert.equal(cancelled.revenueLastWeekCents, before.revenueLastWeekCents + orders[0].totalCostCents);
  assert.notEqual(cancelled.topProducts.find(({ id }) => id === product.id)?.unitsSold, 60);
  await deleteProduct(product);
});

test('the admin overview lists the products that are running low, fewest first', async () => {
  const low = await createProduct({ ...newProduct, name: 'Last Scarf', stock: 1 });
  const enough = await createProduct({ ...newProduct, name: 'Plenty Scarf', stock: 6 });

  const { lowStockProducts } = await getStats();
  assert.deepEqual(lowStockProducts.find(({ id }) => id === low.id), { id: low.id, name: 'Last Scarf', stock: 1 });
  assert.ok(!lowStockProducts.some(({ id }) => id === enough.id));
  assert.ok(lowStockProducts.every(({ stock }) => stock <= 5));
  assert.deepEqual(lowStockProducts.map(({ stock }) => stock), lowStockProducts.map(({ stock }) => stock).sort((a, b) => a - b));

  // Deleted products are no longer in the shop, so they don't need restocking
  await deleteProduct(low);
  assert.ok(!(await getStats()).lowStockProducts.some(({ id }) => id === low.id));
  await deleteProduct(enough);
});

test('orders from before statuses are delivered once all their packages have arrived', { skip: Boolean(process.env.TEST_DATABASE_URL) && 'needs the SQLite file' }, async () => {
  const [arrived, onTheWay] = [randomUUID(), randomUUID()];
  for (const visitorId of [arrived, onTheWay]) {
    await addToCart(visitorId);
    await placeOrder(visitorId);
  }
  const arrivedOrder = (await getOrders(arrived))[0];

  // Turn the database back into one from before statuses, with one order already delivered
  await stopServer();
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();
  const databaseFile = path.join(workDir, 'database.sqlite');
  const database = new SQL.Database(fs.readFileSync(databaseFile));
  const products = [{ ...arrivedOrder.products[0], estimatedDeliveryTimeMs: Date.now() - 1000 }];
  database.run('UPDATE Orders SET products = ? WHERE id = ?', [JSON.stringify(products), arrivedOrder.id]);
  database.run('ALTER TABLE Orders DROP COLUMN status');
  fs.writeFileSync(databaseFile, database.export());
  database.close();
  await startServer();

  assert.equal((await getOrders(arrived))[0].status, 'delivered');
  assert.equal((await getOrders(onTheWay))[0].status, 'processing');
});

test('a deleted product stays in carts and orders but can no longer be added', async () => {
  const visitorId = randomUUID();
  const product = await createProduct();
  const addProduct = () => api('/api/cart-items', {
    visitorId, method: 'POST', body: { productId: product.id, quantity: 1 }
  });

  assert.equal((await addProduct()).status, 201);
  const order = await (await api('/api/orders', { visitorId, method: 'POST' })).json();
  assert.equal((await addProduct()).status, 201);

  await api(`/api/admin/products/${product.id}`, { ...await asAdmin(), method: 'DELETE' });

  const [cartItem] = await (await api('/api/cart-items?expand=product', { visitorId })).json();
  assert.equal(cartItem.product.name, newProduct.name);
  const summary = await (await api('/api/payment-summary', { visitorId })).json();
  assert.equal(summary.productCostCents, newProduct.priceCents);
  assert.equal((await addProduct()).status, 400);

  assert.equal((await api('/api/orders', { visitorId, method: 'POST' })).status, 201);
  const orders = await (await api('/api/orders?expand=products', { visitorId })).json();
  assert.equal(orders.length, 2);
  for (const { products } of orders) {
    assert.equal(products[0].product.name, newProduct.name);
  }
  const savedOrder = await (await api(`/api/orders/${order.id}?expand=products`, { visitorId })).json();
  assert.equal(savedOrder.products[0].product.image, newProduct.image);
  // How the orders page knows not to offer it again
  assert.ok(savedOrder.products[0].product.deletedAt);
});

test('drops the least recently active visitor when there are too many', async () => {
  // The server was started with room for 3 visitors
  const [oldest, active, third, newest] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

  await addToCart(oldest);
  await addToCart(active);
  await addToCart(third);
  // Coming back makes this visitor recent again, so it's kept
  await getCart(active);
  await getCart(newest);

  // Reading a cart counts as activity too, so check the kept visitors first
  assert.equal((await getCart(third)).length, 1);
  assert.equal((await getCart(active)).length, 1);
  assert.deepEqual(await getCart(oldest), []);
});

test('logged in users are never dropped for the visitor limit, even after a restart', async () => {
  // The server was started with room for 3 visitors, and only guests count
  const user = { token: await createToken(), visitorId: randomUUID() };
  const guests = Array.from({ length: 4 }, () => randomUUID());
  await addToCart(user);
  await addToCart(guests[0]);

  const fillWithNewGuests = async () => {
    for (const guestId of guests.slice(1)) {
      await getCart(guestId);
    }
  };
  await fillWithNewGuests();

  assert.equal((await getCart(user)).length, 1);
  assert.equal((await getCart({ token: user.token })).length, 1);
  // The oldest guest made room for the others
  assert.deepEqual(await getCart(guests[0]), []);

  await stopServer();
  await startServer();
  await addToCart(guests[0]);
  await fillWithNewGuests();

  assert.equal((await getCart(user)).length, 1);
});

test('still counts saved visitors after a restart', async () => {
  const [saved, other] = [randomUUID(), randomUUID()];
  await addToCart(saved);
  await addToCart(other);
  const products = await getProducts();

  await stopServer();
  await startServer();

  // The default products are only added to an empty table
  assert.deepEqual(await getProducts(), products);
  assert.equal((await getCart(saved)).length, 1);

  // Only works if the restarted server remembered both visitors: "saved"
  // was just read, so two new visitors push out "other"
  await getCart(randomUUID());
  await getCart(randomUUID());
  assert.equal((await getCart(saved)).length, 1);
  assert.deepEqual(await getCart(other), []);
});

test('returns a single product, including a deleted one', async () => {
  const product = await createProduct();
  const response = await api(`/api/products/${product.id}`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).name, newProduct.name);

  await api(`/api/admin/products/${product.id}`, { ...await asAdmin(), method: 'DELETE' });
  // Links from old orders still open it, and deletedAt tells the page not to sell it
  assert.ok((await (await api(`/api/products/${product.id}`)).json()).deletedAt);

  for (const id of [randomUUID(), 'not-a-uuid']) {
    assert.equal((await api(`/api/products/${id}`)).status, 404, id);
    assert.equal((await api(reviewsPath(id))).status, 404, `reviews of ${id}`);
  }
});

test('only logged in customers who ordered the product can review it', async () => {
  const product = await createProduct();
  const guestId = randomUUID();
  const customer = { token: await createToken() };

  assert.equal((await postReview({ visitorId: guestId }, { stars: 5 }, product.id)).status, 401);
  const expired = await createToken(randomUUID(), { expiresAt: Math.floor(Date.now() / 1000) - 60 });
  assert.equal((await postReview({ token: expired }, { stars: 5 }, product.id)).status, 401);

  // Ordering another product doesn't count
  await addToCart(customer);
  await api('/api/orders', { ...customer, method: 'POST' });
  const refused = await postReview(customer, { stars: 5 }, product.id);
  assert.equal(refused.status, 403);
  assert.match((await refused.json()).error, /ordered this product/);
  assert.equal((await getReviews(customer, product.id)).canReview, false);
  assert.equal((await getReviews({}, product.id)).canReview, false);

  // An order placed as a guest counts once it has moved to the account
  await api('/api/cart-items', { visitorId: guestId, method: 'POST', body: { productId: product.id, quantity: 1 } });
  await api('/api/orders', { visitorId: guestId, method: 'POST' });
  await getCart({ ...customer, visitorId: guestId });
  assert.equal((await getReviews(customer, product.id)).canReview, true);
  assert.equal((await postReview(customer, { stars: 5 }, product.id)).status, 201);
  assert.equal((await getReviews({}, product.id)).reviews.length, 1);
});

test('a cancelled order does not count for reviewing', async () => {
  const product = await createProduct();
  const buyer = await createBuyer(product.id);
  const [order] = await getOrders(buyer);

  assert.equal((await cancelOrder(buyer, order.id)).status, 200);
  assert.equal((await getReviews(buyer, product.id)).canReview, false);
  assert.equal((await postReview(buyer, { stars: 5 }, product.id)).status, 403);
});

test('refuses review fields that are missing or invalid', async () => {
  const buyer = await createBuyer();
  const invalidFields = {
    'without stars': {},
    'with 0 stars': { stars: 0 },
    'with 6 stars': { stars: 6 },
    'with half a star': { stars: 4.5 },
    'with stars as text': { stars: '5' },
    'with text over 500 characters': { stars: 5, text: 'a'.repeat(501) },
    'with text that is not a string': { stars: 5, text: 42 }
  };

  for (const [problem, body] of Object.entries(invalidFields)) {
    const response = await postReview(buyer, body);
    assert.equal(response.status, 400, `a review ${problem}`);
    assert.ok((await response.json()).error);
  }
  assert.ok(!(await getReviews(buyer)).reviews.some((review) => review.isMine));

  const response = await postReview(buyer, { stars: 4, text: `  ${'a'.repeat(500)}  ` });
  assert.equal(response.status, 201);
  const review = await response.json();
  assert.equal(review.text, 'a'.repeat(500));
  await api(`${reviewsPath()}/${review.id}`, { ...buyer, method: 'DELETE' });
});

test('allows one review per user per product', async () => {
  const buyer = await createBuyer();
  const review = await (await postReview(buyer, { stars: 4 })).json();

  assert.equal((await postReview(buyer, { stars: 1, text: 'Changed my mind' })).status, 409);
  const mine = (await getReviews(buyer)).reviews.filter((review) => review.isMine);
  assert.deepEqual(mine.map(({ id, stars }) => ({ id, stars })), [{ id: review.id, stars: 4 }]);

  // Deleting it makes room for a new one
  await api(`${reviewsPath()}/${review.id}`, { ...buyer, method: 'DELETE' });
  const newReview = await postReview(buyer, { stars: 2 });
  assert.equal(newReview.status, 201);
  await api(`${reviewsPath()}/${(await newReview.json()).id}`, { ...buyer, method: 'DELETE' });
});

test('only the author edits a review, and only the author or an admin deletes it', async () => {
  const author = await createBuyer();
  const otherBuyer = await createBuyer();
  const review = await (await postReview(author, { stars: 3, text: 'Fine' })).json();
  const reviewPath = `${reviewsPath()}/${review.id}`;

  for (const [who, name] of [[otherBuyer, 'another customer'], [await asAdmin(), 'an admin']]) {
    const response = await api(reviewPath, { ...who, method: 'PUT', body: { stars: 1 } });
    assert.equal(response.status, 403, `${name} editing`);
  }
  assert.equal((await api(reviewPath, { ...otherBuyer, method: 'DELETE' })).status, 403);
  assert.equal((await api(reviewPath, { method: 'PUT', body: { stars: 1 } })).status, 401);

  const edited = await api(reviewPath, { ...author, method: 'PUT', body: { stars: 5, text: '' } });
  assert.equal(edited.status, 200);
  const { stars, text } = await edited.json();
  assert.deepEqual({ stars, text }, { stars: 5, text: null });
  assert.equal((await api(reviewPath, { ...author, method: 'PUT', body: { stars: 9 } })).status, 400);

  // A review is only found under its own product
  const otherProductPath = `${reviewsPath('15b6fc6f-327a-4ec4-896f-486349e85a3d')}/${review.id}`;
  assert.equal((await api(otherProductPath, { ...author, method: 'DELETE' })).status, 404);
  for (const id of [randomUUID(), 'not-a-uuid']) {
    assert.equal((await api(`${reviewsPath()}/${id}`, { ...author, method: 'DELETE' })).status, 404, id);
  }

  assert.equal((await api(reviewPath, { ...await asAdmin(), method: 'DELETE' })).status, 204);
  assert.ok(!(await getReviews()).reviews.some(({ id }) => id === review.id));
});

test('shows reviews newest first, with a masked name instead of the email', async () => {
  const product = await createProduct();
  const first = await createBuyer(product.id, 'jane.doe@example.com');
  const second = await createBuyer(product.id, 'j@example.com');
  const third = await createBuyer(product.id);
  // The name and user always come from the token, never from the body
  await postReview(first, { stars: 4, text: 'Cozy', authorName: 'Admin', userId: randomUUID() }, product.id);
  await postReview(second, { stars: 3 }, product.id);
  await postReview(third, { stars: 2 }, product.id);

  const { reviews } = await getReviews(first, product.id);
  assert.deepEqual(reviews.map(({ authorName, stars, isMine }) => ({ authorName, stars, isMine })), [
    { authorName: 'Customer', stars: 2, isMine: false },
    { authorName: 'j***', stars: 3, isMine: false },
    { authorName: 'ja***', stars: 4, isMine: true }
  ]);
  assert.ok(!JSON.stringify(reviews).includes('jane'));
  assert.ok(!JSON.stringify(reviews).includes('example.com'));
  assert.ok(reviews.every((review) => !('userId' in review)));
});

test('recalculates the rating from the demo rating and reviews after every change', async () => {
  const product = await createProduct();
  const [first, second] = [await createBuyer(product.id), await createBuyer(product.id)];

  const review = await (await postReview(first, { stars: 5 }, product.id)).json();
  assert.deepEqual(await getRating(product.id), { stars: 5, count: 1 });

  await postReview(second, { stars: 2 }, product.id);
  assert.deepEqual(await getRating(product.id), { stars: 3.5, count: 2 });

  await api(`${reviewsPath(product.id)}/${review.id}`, { ...first, method: 'PUT', body: { stars: 3 } });
  assert.deepEqual(await getRating(product.id), { stars: 2.5, count: 2 });

  await api(`${reviewsPath(product.id)}/${review.id}`, { ...first, method: 'DELETE' });
  assert.deepEqual(await getRating(product.id), { stars: 2, count: 1 });

  // The grid and the product page show the same rating
  const listed = (await getProducts('plaid')).find(({ id }) => id === product.id);
  assert.deepEqual(listed.rating, await getRating(product.id));

  // Reviews add to the demo rating of 4.5 stars from 87, which stays out of responses
  const socksBuyer = await createBuyer();
  const socksReview = await (await postReview(socksBuyer, { stars: 1 })).json();
  const socks = await (await api(`/api/products/${productId}`)).json();
  assert.deepEqual(socks.rating, { stars: 4.5, count: 88 });
  assert.ok(!('demoRating' in socks));
  await api(`${reviewsPath()}/${socksReview.id}`, { ...socksBuyer, method: 'DELETE' });
  assert.deepEqual(await getRating(productId), { stars: 4.5, count: 87 });

  await api(`/api/admin/products/${product.id}`, { ...await asAdmin(), method: 'DELETE' });
});

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

async function createCoupon(fields) {
  const response = await api('/api/admin/coupons', { ...await asAdmin(), method: 'POST', body: { ...newCoupon, ...fields } });
  assert.equal(response.status, 201);
  return response.json();
}

// 2 socks at €10.90 with €4.99 shipping
async function createSocksCart(who) {
  await addProduct(who, productId, 2);
  await api(`/api/cart-items/${productId}`, { ...identify(who), method: 'PUT', body: { deliveryOptionId: '2' } });
}

test('a coupon takes its percentage off the items, before tax, in the summary and the order', async () => {
  const visitorId = randomUUID();
  await createSocksCart(visitorId);

  const summary = await (await api('/api/payment-summary?couponCode=%20welcome10%20', { visitorId })).json();
  assert.deepEqual(summary.coupon, { code: 'WELCOME10', percentOff: 10 });
  assert.equal(summary.productCostCents, 2180);
  assert.equal(summary.discountCents, 218);
  assert.equal(summary.totalCostBeforeTaxCents, 2180 - 218 + 499);
  assert.equal(summary.taxCents, 246);
  assert.equal(summary.totalCostCents, 2707);

  const withoutCoupon = await (await api('/api/payment-summary', { visitorId })).json();
  assert.equal(withoutCoupon.coupon, null);
  assert.equal(withoutCoupon.discountCents, 0);

  // Only the code is sent. The discount comes from the database
  const response = await api('/api/orders', {
    visitorId, method: 'POST', body: { couponCode: 'Welcome10', discountCents: 2000, totalCostCents: 1 }
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).totalCostCents, 2707);
});

test('refuses a coupon that does not exist, is turned off or has expired', async () => {
  await createCoupon({ code: 'OLDSALE', expiresAt: '2020-01-01T00:00:00.000Z' });
  await createCoupon({ code: 'PAUSED', active: false });
  const visitorId = randomUUID();
  await createSocksCart(visitorId);

  for (const [code, refusal] of [
    ['nope', { error: "NOPE isn't a valid coupon code.", code: 'invalidCoupon', params: { code: 'NOPE' } }],
    ['paused', { error: "PAUSED isn't a valid coupon code.", code: 'invalidCoupon', params: { code: 'PAUSED' } }],
    ['oldsale', { error: 'The coupon OLDSALE has expired.', code: 'expiredCoupon', params: { code: 'OLDSALE' } }]
  ]) {
    const summary = await api(`/api/payment-summary?couponCode=${code}`, { visitorId });
    assert.equal(summary.status, 400, code);
    assert.deepEqual(await summary.json(), refusal);

    const order = await api('/api/orders', { visitorId, method: 'POST', body: { couponCode: code } });
    assert.equal(order.status, 400, code);
    const session = await api('/api/stripe/checkout-sessions', {
      visitorId, method: 'POST', headers: { Origin: baseUrl }, body: { couponCode: code }
    });
    assert.equal(session.status, 400, code);
  }
  assert.deepEqual(await getOrders(visitorId), []);
  assert.equal((await getCart(visitorId))[0].quantity, 2);
});

test('tells checkout whether a coupon code works, and what it gives', async () => {
  const response = await api('/api/coupons/welcome10');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 'WELCOME10', percentOff: 10 });

  for (const [code, error] of [['nope', "NOPE isn't a valid coupon code."], ['OLDSALE', 'The coupon OLDSALE has expired.']]) {
    const refused = await api(`/api/coupons/${code}`);
    assert.equal(refused.status, 404, code);
    assert.equal((await refused.json()).error, error);
  }
});

test('card payment charges the discounted total, through a Stripe coupon for this payment', async () => {
  const visitorId = randomUUID();
  await createSocksCart(visitorId);
  const summary = await (await api('/api/payment-summary?couponCode=WELCOME10', { visitorId })).json();

  const response = await api('/api/stripe/checkout-sessions', {
    visitorId, method: 'POST', headers: { Origin: baseUrl }, body: { couponCode: 'welcome10' }
  });
  assert.equal(response.status, 201);
  const session = [...stripeSessions.values()].at(-1);
  const coupon = [...stripeCoupons.values()].at(-1);

  assert.equal(session.amount_total, summary.totalCostCents);
  assert.equal(coupon.amount_off, 218);
  assert.equal(coupon.currency, 'eur');
  assert.equal(coupon.duration, 'once');
  assert.equal(coupon.name, 'WELCOME10 (10% off)');
  assert.deepEqual(coupon.metadata, { app: 'react-ecommerce' });

  session.payment_status = 'paid';
  assert.equal((await (await getPaidOrder(visitorId, session)).json()).totalCostCents, 2707);
});

test('an admin creates, lists and edits coupons', async () => {
  const admin = await asAdmin();
  const coupon = await createCoupon({ code: ' autumn15 ', percentOff: 15, expiresAt: null });
  assert.equal(coupon.code, 'AUTUMN15');
  assert.equal(coupon.expiresAt, null);
  assert.equal(coupon.active, true);

  const duplicate = await api('/api/admin/coupons', { ...admin, method: 'POST', body: { ...newCoupon, code: 'Autumn15' } });
  assert.equal(duplicate.status, 409);

  const coupons = await (await api('/api/admin/coupons', admin)).json();
  assert.deepEqual(coupons.map(({ code }) => code).filter((code) => ['WELCOME10', 'AUTUMN15'].includes(code)), ['WELCOME10', 'AUTUMN15']);

  const changes = { code: 'AUTUMN20', percentOff: 20, expiresAt: '2099-11-30T23:59:59.000Z', active: false, featured: true };
  const updateResponse = await api(`/api/admin/coupons/${coupon.id}`, { ...admin, method: 'PUT', body: changes });
  assert.equal(updateResponse.status, 200);
  const { code, percentOff, expiresAt, active, featured } = await updateResponse.json();
  assert.deepEqual({ code, percentOff, expiresAt, active, featured }, changes);

  const visitorId = randomUUID();
  await addToCart(visitorId);
  assert.equal((await api('/api/payment-summary?couponCode=AUTUMN20', { visitorId })).status, 400);
  await api(`/api/admin/coupons/${coupon.id}`, { ...admin, method: 'PUT', body: { ...changes, active: true } });
  assert.equal((await (await api('/api/payment-summary?couponCode=AUTUMN20', { visitorId })).json()).coupon.percentOff, 20);

  // Not featured any more, so it doesn't take the place of WELCOME10 at checkout for the tests after this one
  await api(`/api/admin/coupons/${coupon.id}`, { ...admin, method: 'PUT', body: { ...changes, featured: false } });
  const taken = await api(`/api/admin/coupons/${coupon.id}`, { ...admin, method: 'PUT', body: { ...changes, code: 'WELCOME10' } });
  assert.equal(taken.status, 409);
  for (const id of [randomUUID(), 'not-a-uuid']) {
    assert.equal((await api(`/api/admin/coupons/${id}`, { ...admin, method: 'PUT', body: changes })).status, 404);
  }
});

test('suggests the newest featured coupon that can be used, or none', async () => {
  const admin = await asAdmin();
  const getFeatured = async () => (await api('/api/featured-coupon')).json();
  assert.deepEqual(await getFeatured(), { code: 'WELCOME10', percentOff: 10 });

  await createCoupon({ code: 'NOTFEATURED', featured: false });
  await createCoupon({ code: 'FEATUREDOLD', featured: true, expiresAt: '2020-01-01T00:00:00.000Z' });
  await createCoupon({ code: 'FEATUREDOFF', featured: true, active: false });
  assert.deepEqual(await getFeatured(), { code: 'WELCOME10', percentOff: 10 });

  const summer = await createCoupon({ code: 'SUMMER20', percentOff: 20, featured: true });
  assert.deepEqual(await getFeatured(), { code: 'SUMMER20', percentOff: 20 });

  const coupons = await (await api('/api/admin/coupons', admin)).json();
  const welcome = coupons.find(({ code }) => code === 'WELCOME10');
  const unfeature = (coupon, featured = false) => api(`/api/admin/coupons/${coupon.id}`, {
    ...admin, method: 'PUT', body: { ...coupon, featured }
  });
  await unfeature(summer);
  await unfeature(welcome);
  assert.equal(await getFeatured(), null);
  await unfeature(welcome, true);
});

test('refuses coupon fields that are missing or invalid', async () => {
  const admin = await asAdmin();
  const invalidFields = {
    'without a code': { code: undefined },
    'with a code of 2 characters': { code: 'AB' },
    'with a code over 20 characters': { code: 'A'.repeat(21) },
    'with spaces inside the code': { code: 'SPRING 25' },
    'without a percentage': { percentOff: undefined },
    'with 0% off': { percentOff: 0 },
    'with more than 90% off': { percentOff: 91 },
    'with a percentage that is not whole': { percentOff: 12.5 },
    'with an expiry that is not a date': { expiresAt: 'next week' },
    'with an expiry as a number': { expiresAt: 1700000000000 },
    'without active': { active: undefined },
    'with active as text': { active: 'yes' },
    'without featured': { featured: undefined },
    'with featured as a number': { featured: 1 }
  };

  for (const [problem, fields] of Object.entries(invalidFields)) {
    const response = await api('/api/admin/coupons', { ...admin, method: 'POST', body: { ...newCoupon, ...fields } });
    assert.equal(response.status, 400, `creating a coupon ${problem}`);
    assert.ok((await response.json()).error);
  }
  assert.ok(!(await (await api('/api/admin/coupons', admin)).json()).some(({ code }) => code === 'SPRING25'));
});

test('orders paid on delivery say so', async () => {
  const visitorId = randomUUID();
  await addToCart(visitorId);
  const order = await (await api('/api/orders', { visitorId, method: 'POST' })).json();
  assert.equal(order.paymentMethod, 'delivery');
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

test('restocks low demo products once a day, unless DEMO_RESTOCK is off', async () => {
  // Starts with 4, and the sun hat starts sold out
  const plates = '3ebe75dc-64d2-4137-8860-1f5a963e534b';
  const sunHat = 'a82c6bac-3067-4e68-a5ba-d827ac0be010';
  const sellPlates = async (quantity) => {
    const visitorId = randomUUID();
    assert.equal((await addProduct(visitorId, plates, quantity)).status, 201);
    assert.equal((await placeOrder(visitorId)).status, 201);
  };
  const adminProduct = await createProduct({ ...newProduct, stock: 1 });

  await sellPlates(3);
  assert.equal(await getStock(plates), 1);

  // The server restocked when it started this test run, and a restart doesn't count as a new day
  await stopServer();
  await startServer();
  assert.equal(await getStock(plates), 1);

  const aDayLater = { DEMO_RESTOCK_INTERVAL_MS: '1' };
  for (const DEMO_RESTOCK of ['false', 'OFF', '0']) {
    await stopServer();
    await startServer({ ...aDayLater, DEMO_RESTOCK });
    assert.equal(await getStock(plates), 1, DEMO_RESTOCK);
  }

  await stopServer();
  await startServer(aDayLater);
  assert.equal(await getStock(plates), 4);
  assert.equal(await getStock(sunHat), 0);
  assert.equal(await getStock(adminProduct.id), 1);

  // A product request a day later restocks too, without a restart
  await sellPlates(4);
  assert.equal(await getStock(plates), 4);

  await stopServer();
  await startServer();
  await deleteProduct(adminProduct);
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

// Hides the whole catalog, so it runs last
test('deleted products stay deleted after a restart, even when none are left', async () => {
  const admin = await asAdmin();
  for (const { id } of await getProducts()) {
    await api(`/api/admin/products/${id}`, { ...admin, method: 'DELETE' });
  }

  await stopServer();
  await startServer();

  assert.deepEqual(await getProducts(), []);
  assert.equal((await api('/api/admin/images', admin)).status, 200);
});

test('sends security headers, with a content security policy that lets the browser reach Supabase', async () => {
  const response = await api('/api/products');
  const policy = response.headers.get('content-security-policy');

  assert.match(policy, /default-src 'self'/);
  assert.match(policy, new RegExp(`connect-src 'self' ${supabaseUrl}`));
  assert.match(policy, /script-src 'self'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('only allows the configured origins to call the API from another site', async () => {
  const allowedOrigin = async (origin) => (await api('/api/products', { headers: { Origin: origin } }))
    .headers.get('access-control-allow-origin');

  // Outside production, the Vite dev server is allowed by default
  assert.equal(await allowedOrigin('http://localhost:5173'), 'http://localhost:5173');
  assert.equal(await allowedOrigin('https://evil.example'), null);

  await stopServer();
  await startServer({ NODE_ENV: 'production' });
  assert.equal(await allowedOrigin('http://localhost:5173'), null);

  await stopServer();
  await startServer({ NODE_ENV: 'production', CORS_ORIGIN: 'https://shop.example, https://www.shop.example' });
  assert.equal(await allowedOrigin('https://www.shop.example'), 'https://www.shop.example');
  assert.equal(await allowedOrigin('https://evil.example'), null);
  await stopServer();
  await startServer();
});

// A request to the server with another Host header, which fetch doesn't let a script set
function requestWithHost(host, urlPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request(`${baseUrl}${urlPath}`, { method, headers: { Host: host } }, (response) => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('redirects the Render address to the public one, except for the Stripe webhook', async () => {
  const publicSite = 'https://shop.example.com';
  const renderHost = 'old-shop.example.com';
  const startWith = async (settings) => {
    await stopServer();
    await startServer(settings);
  };

  await startWith({ PUBLIC_SITE_URL: `${publicSite}/`, RENDER_EXTERNAL_HOSTNAME: renderHost });
  const moved = await requestWithHost(renderHost, '/products/abc?search=socks&sort=price');
  assert.deepEqual(moved, { status: 301, location: `${publicSite}/products/abc?search=socks&sort=price` });
  assert.deepEqual(await requestWithHost(renderHost, '/'), { status: 301, location: `${publicSite}/` });
  assert.equal((await requestWithHost(renderHost, '/api/cart-items', 'POST')).status, 301);

  // Stripe doesn't follow redirects, so the webhook is handled where it is asked
  assert.equal((await requestWithHost(renderHost, '/api/stripe/webhook', 'POST')).status, 400);
  // Other addresses are served as they are, like localhost and the public address itself
  assert.equal((await requestWithHost('localhost', '/api/products')).status, 200);
  assert.equal((await requestWithHost('shop.example.com', '/api/products')).status, 200);

  await startWith({ RENDER_EXTERNAL_HOSTNAME: renderHost });
  assert.equal((await requestWithHost(renderHost, '/api/products')).status, 200);

  // Never in a loop, even when Render's address is the public one
  await startWith({ PUBLIC_SITE_URL: `https://${renderHost}`, RENDER_EXTERNAL_HOSTNAME: renderHost });
  assert.equal((await requestWithHost(renderHost, '/api/products')).status, 200);

  await startWith({ PUBLIC_SITE_URL: publicSite });
  assert.equal((await requestWithHost(renderHost, '/api/products')).status, 200);

  await startWith({});
});

test('refuses to start with a PUBLIC_SITE_URL that is not a web address', async () => {
  await stopServer();
  await assert.rejects(startServer({ PUBLIC_SITE_URL: 'shop.example.com' }), /exited with code 1/);
  await startServer();
});

test('the public address is allowed by CORS and where Stripe sends the customer back', async () => {
  const publicSite = 'https://shop.example.com';
  await stopServer();
  await startServer({ NODE_ENV: 'production', PUBLIC_SITE_URL: publicSite });
  const response = await api('/api/products', { headers: { Origin: publicSite } });
  assert.equal(response.headers.get('access-control-allow-origin'), publicSite);

  const visitorId = randomUUID();
  await addProduct(visitorId, (await createProduct()).id, 1);
  assert.equal((await checkout(visitorId, publicSite)).status, 201);
  const session = [...stripeSessions.values()].at(-1);
  assert.equal(session.success_url, `${publicSite}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  assert.equal(session.cancel_url, `${publicSite}/checkout`);

  // From another site, it is still refused
  assert.equal((await checkout(visitorId, 'https://example.com')).status, 400);
  await stopServer();
  await startServer();
});

test('refuses a request body over 10 kB', async () => {
  const response = await api('/api/cart-items', {
    visitorId: randomUUID(), method: 'POST', body: { productId, quantity: 1, note: 'x'.repeat(11 * 1024) }
  });
  assert.equal(response.status, 413);
  assert.ok((await response.json()).error);
});

test('a logged in user saves products to a wishlist of their own, each once', async () => {
  const user = { token: await createToken() };
  const otherUser = { token: await createToken() };
  const scarf = await createProduct();
  const hat = await createProduct({ ...newProduct, name: 'Wool Hat' });
  const wishlistPath = (id) => `/api/wishlist/${id}`;
  const getWishlist = async (who) => (await api('/api/wishlist', who)).json();

  assert.equal((await api('/api/wishlist', { visitorId: randomUUID() })).status, 401);
  assert.equal((await api(wishlistPath(hat.id), { visitorId: randomUUID(), method: 'PUT' })).status, 401);

  assert.equal((await api(wishlistPath(hat.id), { ...user, method: 'PUT' })).status, 204);
  assert.equal((await api(wishlistPath(scarf.id.toUpperCase()), { ...user, method: 'PUT' })).status, 204);
  // Saved twice, kept once
  assert.equal((await api(wishlistPath(scarf.id), { ...user, method: 'PUT' })).status, 204);

  const wishlist = await getWishlist(user);
  assert.deepEqual(wishlist.map((item) => item.productId), [scarf.id, hat.id]);
  assert.equal(wishlist[0].product.name, newProduct.name);
  assert.deepEqual(await getWishlist(otherUser), []);

  // A deleted product stays, so the user sees it's no longer available, but can't be saved again
  await deleteProduct(scarf);
  assert.ok((await getWishlist(user))[0].product.deletedAt);
  assert.equal((await api(wishlistPath(scarf.id), { ...otherUser, method: 'PUT' })).status, 404);
  assert.equal((await api(wishlistPath(randomUUID()), { ...user, method: 'PUT' })).status, 404);
  assert.equal((await api(wishlistPath('not-a-uuid'), { ...user, method: 'PUT' })).status, 404);

  assert.equal((await api(wishlistPath(scarf.id), { ...user, method: 'DELETE' })).status, 204);
  assert.equal((await api(wishlistPath(scarf.id), { ...user, method: 'DELETE' })).status, 204);
  assert.deepEqual((await getWishlist(user)).map((item) => item.productId), [hat.id]);
  await deleteProduct(hat);
});

test('unknown API paths are not found, and every admin path needs an admin first', async () => {
  const unknown = await api('/api/nothing-here');
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: 'Not found' });

  assert.equal((await api('/api/admin/nothing-here')).status, 401);
  assert.equal((await api('/api/admin/nothing-here', { token: await createToken() })).status, 403);
  assert.equal((await api('/api/admin/nothing-here', await asAdmin())).status, 404);
});

test('limits how often one address can guess coupons, place orders, write reviews and check tokens', async () => {
  await stopServer();
  await startServer({ RATE_LIMIT_SCALE: '1' });

  // Every request with a code shares one budget of 60, wherever the code is typed
  const visitorId = randomUUID();
  for (let i = 0; i < 58; i++) {
    assert.equal((await api(`/api/coupons/GUESS${i}`)).status, 404);
  }
  assert.equal((await api('/api/payment-summary?couponCode=GUESSA', { visitorId })).status, 400);
  assert.equal((await api('/api/orders', { visitorId, method: 'POST', body: { couponCode: 'GUESSB' } })).status, 400);
  const limited = await api('/api/coupons/WELCOME10');
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'Too many requests. Please wait a few minutes and try again.', code: 'tooManyRequests' });
  assert.ok(limited.headers.get('ratelimit-policy'));
  // Without a code, checkout isn't slowed down
  assert.equal((await api('/api/payment-summary', { visitorId })).status, 200);

  // 1 order was already tried above
  for (let i = 0; i < 29; i++) {
    assert.equal((await placeOrder(visitorId)).status, 400);
  }
  assert.equal((await placeOrder(visitorId)).status, 429);

  for (let i = 0; i < 20; i++) {
    assert.equal((await postReview({}, { stars: 5 })).status, 401);
  }
  assert.equal((await postReview({}, { stars: 5 })).status, 429);

  for (let i = 0; i < 100; i++) {
    assert.equal((await api('/api/me')).status, 200);
  }
  assert.equal((await api('/api/me')).status, 429);

  // The products don't share these limits
  assert.equal((await api('/api/products')).status, 200);
  await stopServer();
  await startServer();
});
