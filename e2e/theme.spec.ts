import { expect, test } from '@playwright/test';
import { addToCart, expectNoViolations, goToCheckout, logIn, placeOrder, productCard } from './helpers.ts';
import { ADMIN } from './settings.ts';

const darkBackground = 'rgb(13, 17, 23)';

test('dark mode can be turned on, and stays on after a reload', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Dark mode' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.click();
  await expect(page.locator('body')).toHaveCSS('background-color', darkBackground);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveCSS('background-color', darkBackground);

  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 247, 248)');
});

test.describe('with a dark system theme', () => {
  test.use({ colorScheme: 'dark' });

  test('the shop follows it and its pages pass an accessibility check', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).toHaveCSS('background-color', darkBackground);
    await expectNoViolations(page);

    await productCard(page, 'Women\'s Chunky Knit Sweater - Black').getByRole('link').click();
    await expect(page.getByRole('region', { name: 'You may also like' })).toBeVisible();
    await expectNoViolations(page);

    await page.goto('/');
    await addToCart(page, 'Bath Towels 2 Pack - Gray');
    await goToCheckout(page);
    await expectNoViolations(page);
    await placeOrder(page);
    await expectNoViolations(page);

    await page.goto('/page-that-does-not-exist');
    await expectNoViolations(page);
  });

  test('the account, wishlist and admin pages pass an accessibility check', async ({ page }) => {
    await logIn(page, ADMIN.email);
    await page.goto('/');
    await productCard(page, 'Round Sunglasses').getByTestId('wishlist-button').click();
    await page.goto('/wishlist');
    await expect(productCard(page, 'Round Sunglasses')).toBeVisible();
    await expectNoViolations(page);

    await page.goto('/account');
    await expectNoViolations(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Store overview' })).toBeVisible();
    await expectNoViolations(page);

    await page.goto('/admin/orders');
    await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    await expectNoViolations(page);
  });
});
