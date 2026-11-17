import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { generateKeyPair } from 'jose';
import {
  addToCart, adminId, api, asAdmin, createToken, getCart, getProducts, productId, startServer,
  stopServer, useTestServer
} from './helpers.js';

useTestServer();

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
