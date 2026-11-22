import { expect, test } from '@playwright/test';
import { addToCart, expectNoViolations, goToCheckout, logIn, placeOrder } from './helpers.ts';
import { ADMIN } from './settings.ts';

test('the orders and tracking pages pass an accessibility check', async ({ page }) => {
  await page.goto('/');
  await addToCart(page, 'Blackout Curtains Set - Beige');
  await goToCheckout(page);
  await expectNoViolations(page);
  await placeOrder(page);
  await expectNoViolations(page);

  await page.getByRole('link', { name: 'Track package' }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expectNoViolations(page);
});

test('the admin pages pass an accessibility check', async ({ page }) => {
  await logIn(page, ADMIN.email);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1, name: 'Store overview' })).toBeVisible();
  await expectNoViolations(page);

  await page.getByTestId('admin-orders-link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expectNoViolations(page);
});

test('a keyboard user ships an order and keeps their place', async ({ page }) => {
  await page.goto('/');
  await addToCart(page, 'Enamel Stovetop Kettle - White');
  await goToCheckout(page);
  const orderId = (await placeOrder(page)).slice(0, 8);

  await logIn(page, ADMIN.email);
  await page.goto('/admin/orders?status=processing');
  const shipButton = page.getByRole('button', { name: `Mark shipped, order ${orderId}` });
  await shipButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: `Mark delivered, order ${orderId}` })).toBeFocused();
  await page.keyboard.press('Enter');
  const row = page.getByTestId('admin-order-row').filter({ hasText: `#${orderId}` });
  await expect(row.getByTestId('order-status')).toHaveText('Delivered');
  await expect(row.getByTestId('order-status').locator('..')).toBeFocused();
});
