import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addProduct, addToCart, api, asAdmin, baseUrl, getCart, getOrders, getPaidOrder, identify, newCoupon,
  productId, stripeCoupons, stripeSessions, useTestServer
} from './helpers.js';

useTestServer();

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
