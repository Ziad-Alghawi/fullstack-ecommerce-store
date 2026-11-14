import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { PASSWORD } from './settings.ts';

// WCAG 2.1 A and AA, the level Lighthouse and most audits check
export async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`)).toEqual([]);
}

export function productCard(page: Page, name: string) {
  return page.getByTestId('product-container').filter({ hasText: name });
}

// From the shop, as a new browser context is a new visitor with an empty cart
export async function addToCart(page: Page, name: string, quantity = 1) {
  const card = productCard(page, name);
  await card.getByLabel(`Quantity of ${name}`).selectOption(String(quantity));
  await card.getByTestId('add-to-cart-button').click();
  await expect(page.getByTestId('header-cart-link')).toHaveAccessibleName(new RegExp(`^Cart, ${quantity} items?$`));
}

export async function goToCheckout(page: Page) {
  await page.getByTestId('header-cart-link').click();
  await expect(page).toHaveURL('/checkout');
}

// Places the order on the checkout page, paid on delivery, and returns its ID from the orders page
export async function placeOrder(page: Page) {
  await page.getByTestId('place-order-button').click();
  await expect(page).toHaveURL('/orders');
  return (await page.getByTestId('order-id').first().textContent())!.trim();
}

export async function logIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill(PASSWORD);
  await page.getByTestId('login-submit-button').click();
  await expect(page.getByTestId('header-account-link')).toBeVisible();
}
