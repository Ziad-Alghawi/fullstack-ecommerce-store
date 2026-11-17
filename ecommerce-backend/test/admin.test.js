import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addProduct, addToCart, adminId, api, asAdmin, cancelOrder, createProduct, createToken, deleteProduct,
  getAdminOrders, getOrders, getPaidOrder, getProducts, getStock, newCoupon, newProduct, placeOrder,
  productId, setOrderStatus, startCheckout, useTestServer
} from './helpers.js';

useTestServer();

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
