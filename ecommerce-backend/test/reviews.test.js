import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addToCart, api, asAdmin, cancelOrder, createBuyer, createProduct, createToken, getCart, getOrders,
  getProducts, getRating, getReviews, postReview, productId, reviewsPath, useTestServer
} from './helpers.js';

useTestServer();

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
