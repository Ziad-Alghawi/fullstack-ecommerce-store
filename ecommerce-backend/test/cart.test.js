import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addProduct, api, asAdmin, createProduct, deleteProduct, getCart, newProduct, setStock, useTestServer
} from './helpers.js';

useTestServer();

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
