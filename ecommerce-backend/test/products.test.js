import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addProduct, api, asAdmin, createProduct, deleteProduct, getProducts, getStock, newProduct,
  placeOrder, productId, reviewsPath, startServer, stopServer, useTestServer
} from './helpers.js';

useTestServer();

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
