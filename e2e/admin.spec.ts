import { expect, test } from '@playwright/test';
import { addToCart, goToCheckout, logIn, placeOrder } from './helpers.ts';
import { ADMIN } from './settings.ts';

test('an admin ships an order, and the customer sees it shipped', async ({ page, browser }) => {
  await page.goto('/');
  await addToCart(page, 'Round Sunglasses');
  await goToCheckout(page);
  const orderId = await placeOrder(page);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await logIn(adminPage, ADMIN.email);
  await adminPage.getByTestId('header-admin-link').click();
  await expect(adminPage.getByRole('heading', { level: 1, name: 'Store overview' })).toBeVisible();
  await adminPage.getByTestId('admin-orders-link').click();

  await adminPage.getByTestId('admin-order-status-filter').selectOption('Processing');
  await expect(adminPage).toHaveURL('/admin/orders?status=processing');
  const row = adminPage.getByTestId('admin-order-row').filter({ hasText: `#${orderId.slice(0, 8)}` });
  await expect(row).toContainText('1 × Round Sunglasses');
  await expect(row).toContainText('Guest');
  await row.getByRole('button', { name: `Mark order ${orderId.slice(0, 8)} shipped` }).click();
  await expect(row.getByTestId('order-status')).toHaveText('Shipped');
  await expect(row.getByTestId('admin-order-delivered-button')).toBeVisible();
  await adminContext.close();

  await page.reload();
  const order = page.getByTestId('order-container').filter({ hasText: orderId });
  await expect(order.getByTestId('order-status')).toHaveText('Shipped');
  await expect(order.getByTestId('cancel-order-button')).toHaveCount(0);
});

test('a customer who is not an admin cannot open the admin pages', async ({ page }) => {
  await logIn(page, 'shopper@example.com');
  await expect(page.getByTestId('header-admin-link')).toHaveCount(0);

  await page.goto('/admin/orders');
  await expect(page.getByTestId('admin-forbidden-message')).toBeVisible();
});

test('the admin orders page fits phones and desktops without scrolling sideways', async ({ page, browser }) => {
  await page.goto('/');
  await addToCart(page, 'Glass Food Containers With Bamboo Lids - 3 Pieces');
  await goToCheckout(page);
  await placeOrder(page);

  for (const width of [320, 375, 1440]) {
    const isPhone = width < 640;
    const adminContext = await browser.newContext({ viewport: { width, height: 800 }, isMobile: isPhone, hasTouch: isPhone });
    const adminPage = await adminContext.newPage();
    await logIn(adminPage, ADMIN.email);
    await adminPage.goto('/admin/orders');
    const badge = adminPage.getByTestId('order-status').first();
    await expect(badge).toBeVisible();

    expect(await adminPage.evaluate<number>('document.documentElement.scrollWidth'), `${width}px`).toBeLessThanOrEqual(width);
    // The table's container clips what sticks out, so the badge has to end inside it
    const container = (await adminPage.locator('.admin-table-container').boundingBox())!;
    const badgeBox = (await badge.boundingBox())!;
    expect(badgeBox.x + badgeBox.width, `${width}px`).toBeLessThanOrEqual(container.x + container.width);
    await adminContext.close();
  }
});
