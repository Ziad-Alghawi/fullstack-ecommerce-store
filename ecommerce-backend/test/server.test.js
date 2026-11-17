import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import {
  addProduct, addToCart, api, asAdmin, baseUrl, checkout, createProduct, createToken, placeOrder,
  postReview, productId, startServer, stopServer, stripeSessions, supabaseUrl, useTestServer
} from './helpers.js';

useTestServer();

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

test('refuses a request body over 10 kB', async () => {
  const response = await api('/api/cart-items', {
    visitorId: randomUUID(), method: 'POST', body: { productId, quantity: 1, note: 'x'.repeat(11 * 1024) }
  });
  assert.equal(response.status, 413);
  assert.ok((await response.json()).error);
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
