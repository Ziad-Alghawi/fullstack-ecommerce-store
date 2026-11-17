import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  addProduct, addToCart, api, cancelOrder, createProduct, createToken, databaseUrl, deleteProduct,
  getCart, getOrders, getStock, identify, newProduct, placeOrder, productId, setStock, startServer,
  stopServer, useTestServer, workDir
} from './helpers.js';

useTestServer();

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

// Turns the database back into one from before statuses: the arrived order's package has arrived, and
// Orders has no status column. The file is rewritten on SQLite, and Postgres is asked, as production is
async function makeDatabaseFromBeforeStatuses(order, products) {
  const productsJson = JSON.stringify(products);
  if (databaseUrl) {
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query('UPDATE "Orders" SET products = $1 WHERE id = $2', [productsJson, order.id]);
    await client.query('ALTER TABLE "Orders" DROP COLUMN status');
    await client.end();
    return;
  }

  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();
  const databaseFile = path.join(workDir, 'database.sqlite');
  const database = new SQL.Database(fs.readFileSync(databaseFile));
  database.run('UPDATE Orders SET products = ? WHERE id = ?', [productsJson, order.id]);
  database.run('ALTER TABLE Orders DROP COLUMN status');
  fs.writeFileSync(databaseFile, database.export());
  database.close();
}

test('orders from before statuses are delivered once all their packages have arrived', async () => {
  const [arrived, onTheWay] = [randomUUID(), randomUUID()];
  for (const visitorId of [arrived, onTheWay]) {
    await addToCart(visitorId);
    await placeOrder(visitorId);
  }
  const arrivedOrder = (await getOrders(arrived))[0];

  await stopServer();
  await makeDatabaseFromBeforeStatuses(arrivedOrder, [{ ...arrivedOrder.products[0], estimatedDeliveryTimeMs: Date.now() - 1000 }]);
  await startServer();

  assert.equal((await getOrders(arrived))[0].status, 'delivered');
  assert.equal((await getOrders(onTheWay))[0].status, 'processing');
});

test('orders paid on delivery say so', async () => {
  const visitorId = randomUUID();
  await addToCart(visitorId);
  const order = await (await api('/api/orders', { visitorId, method: 'POST' })).json();
  assert.equal(order.paymentMethod, 'delivery');
});
