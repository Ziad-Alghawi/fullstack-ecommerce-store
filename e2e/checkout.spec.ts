import { expect, test, type Page } from '@playwright/test';
import { addToCart, goToCheckout, placeOrder } from './helpers.ts';

async function readOrderTotal(page: Page) {
  return page.getByTestId('payment-summary-total').locator('.payment-summary-money').innerText();
}

test('a guest orders, pays on delivery and sees the order', async ({ page }) => {
  await page.goto('/');
  await addToCart(page, 'Gray Hand Knit Wool Socks', 2);

  await goToCheckout(page);
  await expect(page.getByTestId('payment-summary-product-cost')).toContainText('$21.80');
  const total = await readOrderTotal(page);
  await placeOrder(page);

  const order = page.getByTestId('order-container').first();
  await expect(order.getByTestId('order-total')).toHaveText(total);
  await expect(order.getByTestId('order-payment')).toHaveText('Pay on delivery');
  await expect(order.getByTestId('order-status')).toHaveText('Processing');
  await expect(order).toContainText('Gray Hand Knit Wool Socks');
  await expect(order).toContainText('Quantity: 2');
  await expect(page.getByTestId('header-cart-link')).toHaveAccessibleName('Cart, 0 items');
});

test('a coupon takes its discount off the order', async ({ page }) => {
  await page.goto('/');
  await addToCart(page, '2 Slot Toaster - White');
  await goToCheckout(page);

  await page.getByTestId('coupon-input').fill('welcome10');
  await page.getByTestId('coupon-apply-button').click();
  await expect(page.getByTestId('coupon-applied')).toContainText('WELCOME10');
  // 10% of $18.99
  await expect(page.getByTestId('payment-summary-discount')).toContainText('-$1.90');
  const total = await readOrderTotal(page);

  await placeOrder(page);
  await expect(page.getByTestId('order-total').first()).toHaveText(total);
});

test('a customer cancels an order before it ships', async ({ page }) => {
  await page.goto('/');
  await addToCart(page, 'Ultra Soft Tissue 2-Ply - 8 Boxes');
  await goToCheckout(page);
  await placeOrder(page);

  const order = page.getByTestId('order-container').first();
  await order.getByTestId('cancel-order-button').click();
  await order.getByTestId('confirm-cancel-order-button').click();
  await expect(order.getByTestId('order-status')).toHaveText('Cancelled');
  await expect(order.getByTestId('cancel-order-button')).toHaveCount(0);
});
