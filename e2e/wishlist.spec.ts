import { expect, test } from '@playwright/test';
import { expectNoViolations, logIn, productCard } from './helpers.ts';

const BASKETBALL = 'Intermediate Size Basketball';

test('a guest is asked to log in before saving a product', async ({ page }) => {
  await page.goto('/');
  await productCard(page, BASKETBALL).getByRole('button', { name: `Save ${BASKETBALL} to your wishlist` }).click();
  await expect(page.getByRole('status', { name: 'Notifications' })).toContainText('Log in to save products to your wishlist');

  await page.getByTestId('header-wishlist-link').click();
  await expect(page.getByTestId('wishlist-login-message')).toBeVisible();
});

test('a customer saves a product, finds it on their wishlist on every visit, and removes it', async ({ page }) => {
  await logIn(page, 'wishlist@example.com');
  await page.goto('/');

  const heart = productCard(page, BASKETBALL).getByTestId('wishlist-button');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status', { name: 'Notifications' })).toContainText(`${BASKETBALL} saved to your wishlist`);

  await page.getByTestId('header-wishlist-link').click();
  await expect(page).toHaveURL('/wishlist');
  await expect(page.getByTestId('product-container')).toHaveCount(1);
  await page.reload();
  await expect(productCard(page, BASKETBALL)).toBeVisible();
  await expectNoViolations(page);

  await productCard(page, BASKETBALL).getByTestId('wishlist-button').click();
  await expect(page.getByTestId('wishlist-empty-message')).toBeVisible();
});
