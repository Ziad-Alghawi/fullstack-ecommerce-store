import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  api, createProduct, createToken, deleteProduct, newProduct, useTestServer
} from './helpers.js';

useTestServer();

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
