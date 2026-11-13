import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addToCart, goToCheckout, logIn, placeOrder } from './helpers.ts';
import { ADMIN } from './settings.ts';

// WCAG 2.1 A and AA, the level Lighthouse and most audits check
async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`)).toEqual([]);
}

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
  const shipButton = page.getByRole('button', { name: `Mark order ${orderId} shipped` });
  await shipButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: `Mark order ${orderId} delivered` })).toBeFocused();
  await page.keyboard.press('Enter');
  const row = page.getByTestId('admin-order-row').filter({ hasText: `#${orderId}` });
  await expect(row.getByTestId('order-status')).toHaveText('Delivered');
  await expect(row.getByTestId('order-status').locator('..')).toBeFocused();
});
