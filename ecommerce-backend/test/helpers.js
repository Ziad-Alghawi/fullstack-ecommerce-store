// The setup and helpers the API tests share. Each test file starts its own server, with its own database
import { before, after } from 'node:test';
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
export const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-backend-test-'));
export const productId = 'e43638ce-6aa0-4b85-b27f-e1d07eb678c6';
export const adminId = randomUUID();
export const newProduct = {
  name: 'Plaid Wool Scarf',
  priceCents: 1599,
  image: 'images/products/gray-hand-knit-wool-socks.jpg',
  keywords: ['scarves', 'plaid'],
  category: 'Accessories',
  stock: 25
};

export const newCoupon = { code: 'spring25', percentOff: 25, expiresAt: '2099-06-30T23:59:59.000Z', active: true, featured: false };

let server;
export let baseUrl;
let supabase;
export let supabaseUrl;
let signingKey;
let stripeApi;
let stripeSettings;
const webhookSecret = 'whsec_test_secret';
// The Checkout Sessions the server created, by ID, and their line items
export const stripeSessions = new Map();
export const stripeLineItems = new Map();
export const stripeCoupons = new Map();
// The refunds the server asked for, by idempotency key. Tests call setRefundError to make Stripe refuse the next ones
const stripeRefunds = new Map();
let refundError = null;
// A throwaway Postgres database for this test file, when TEST_DATABASE_URL is set. Empty means SQLite
export let databaseUrl = '';

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

export function createToken(userId = randomUUID(), {
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

export async function startServer(settings = {}) {
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
    DATABASE_URL: databaseUrl,
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

export async function stopServer() {
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill();
  await exited;
}

// A guest is their visitor ID. A logged in user is { token }, plus the browser's visitorId if any
export function api(urlPath, {
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

export const identify = (who) => (typeof who === 'string' ? { visitorId: who } : who);

export async function addToCart(who) {
  const response = await api('/api/cart-items', {
    ...identify(who), method: 'POST', body: { productId, quantity: 1 }
  });
  assert.equal(response.status, 201);
}

export async function getCart(who) {
  return (await api('/api/cart-items', identify(who))).json();
}

export async function asAdmin() {
  return { token: await createToken(adminId) };
}

export async function createProduct(fields = newProduct) {
  const response = await api('/api/admin/products', { ...await asAdmin(), method: 'POST', body: fields });
  assert.equal(response.status, 201);
  return response.json();
}

// A search word, or a query string starting with ?
export async function getProducts(query = '') {
  const queryString = query.startsWith('?') || !query ? query : `?search=${query}`;
  return (await api(`/api/products${queryString}`)).json();
}

// A logged in user who has ordered the product, so they can review it
export async function createBuyer(orderedProductId = productId, email) {
  const buyer = { token: await createToken(randomUUID(), { email }) };
  await api('/api/cart-items', { ...buyer, method: 'POST', body: { productId: orderedProductId, quantity: 1 } });
  assert.equal((await api('/api/orders', { ...buyer, method: 'POST' })).status, 201);
  return buyer;
}

export const reviewsPath = (id = productId) => `/api/products/${id}/reviews`;

export function postReview(who, body, id = productId) {
  return api(reviewsPath(id), { ...who, method: 'POST', body });
}

export async function getReviews(who = {}, id = productId) {
  return (await api(reviewsPath(id), who)).json();
}

export async function getStock(id) {
  return (await (await api(`/api/products/${id}`)).json()).stock;
}

export async function setStock(product, stock) {
  const response = await api(`/api/admin/products/${product.id}`, {
    ...await asAdmin(), method: 'PUT', body: { ...newProduct, name: product.name, stock }
  });
  assert.equal(response.status, 200);
}

export function addProduct(who, id, quantity = 1) {
  return api('/api/cart-items', { ...identify(who), method: 'POST', body: { productId: id, quantity } });
}

export function placeOrder(who) {
  return api('/api/orders', { ...identify(who), method: 'POST' });
}

export async function deleteProduct(product) {
  await api(`/api/admin/products/${product.id}`, { ...await asAdmin(), method: 'DELETE' });
}

export async function getRating(id) {
  return (await (await api(`/api/products/${id}`)).json()).rating;
}

export async function getOrders(who) {
  return (await api('/api/orders', identify(who))).json();
}

export function checkout(who, origin = baseUrl) {
  return api('/api/stripe/checkout-sessions', { ...identify(who), method: 'POST', headers: { Origin: origin } });
}

// What clicking Pay with card does. Returns the session the Stripe stand-in got
export async function startCheckout(who) {
  const response = await checkout(who);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).url, 'https://checkout.stripe.com/c/pay/test');
  return [...stripeSessions.values()].at(-1);
}

// What the success page asks for after Stripe sends the customer back
export function getPaidOrder(who, session) {
  return api(`/api/stripe/checkout-sessions/${session.id}/order`, identify(who));
}

// Signed like Stripe signs webhooks: an HMAC of the timestamp and the exact body
export function sendWebhook(event, { secret = webhookSecret, body = JSON.stringify(event) } = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${JSON.stringify(event)}`).digest('hex');
  return fetch(`${baseUrl}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${timestamp},v1=${signature}` },
    body
  });
}

export function checkoutCompleted(session) {
  return { id: `evt_${randomUUID()}`, object: 'event', type: 'checkout.session.completed', data: { object: session } };
}

export function cancelOrder(who, orderId) {
  return api(`/api/orders/${orderId}/cancel`, { ...identify(who), method: 'POST' });
}

// A card order of one Plaid Wool Scarf, paid and created like the success page does
export async function placeCardOrder(product, visitorId = randomUUID()) {
  await addProduct(visitorId, product.id);
  const session = await startCheckout(visitorId);
  session.payment_status = 'paid';
  const order = await (await getPaidOrder(visitorId, session)).json();
  return { visitorId, session, order };
}

export function refundsFor(session) {
  return [...stripeRefunds.values()].filter(({ payment_intent }) => payment_intent === session.payment_intent);
}

export async function getAdminOrders(query = '') {
  const response = await api(`/api/admin/orders${query}`, await asAdmin());
  assert.equal(response.status, 200);
  return response.json();
}

export async function setOrderStatus(orderId, status) {
  return api(`/api/admin/orders/${orderId}`, { ...await asAdmin(), method: 'PATCH', body: { status } });
}

export function setRefundError(error) {
  refundError = error;
}

// Tests delete visitors and products, so on Postgres each file gets a database of its own, dropped afterwards
async function onTestDatabase(query) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}

async function createDatabase() {
  if (!process.env.TEST_DATABASE_URL) return;
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  await onTestDatabase(`CREATE DATABASE ${name}`);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  databaseUrl = url.toString();
}

async function dropDatabase() {
  if (!databaseUrl) return;
  await onTestDatabase(`DROP DATABASE ${new URL(databaseUrl).pathname.slice(1)}`);
}

// Starts the stand-ins and the server before the file's tests, and stops them after
export function useTestServer() {
  before(async () => {
    await createDatabase();
    await startSupabase();
    await startStripe();
    await startServer();
  });
  after(async () => {
    await stopServer();
    supabase.close();
    stripeApi.close();
    await dropDatabase();
    fs.rmSync(workDir, { recursive: true, force: true });
  });
}
