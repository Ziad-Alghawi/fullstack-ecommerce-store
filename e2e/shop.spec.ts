import { expect, test } from '@playwright/test';
import { addToCart, productCard } from './helpers.ts';

test('browses a category, then searches by keyword', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('products-count')).toHaveText(/^\d+ products$/);

  await page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'Sports' }).click();
  await expect(page).toHaveURL('/?category=Sports');
  await expect(productCard(page, 'Intermediate Size Basketball')).toBeVisible();
  await expect(productCard(page, 'Gray Hand Knit Wool Socks')).toHaveCount(0);

  await page.getByTestId('sort-select').selectOption('Price: low to high');
  await expect(page).toHaveURL('/?category=Sports&sort=price-asc');

  await page.getByTestId('header-search-bar').fill('socks');
  await page.getByTestId('header-search-button').click();
  await expect(page).toHaveURL('/?search=socks');
  await expect(productCard(page, 'Gray Hand Knit Wool Socks')).toBeVisible();
  await expect(productCard(page, 'Intermediate Size Basketball')).toHaveCount(0);

  await productCard(page, 'Gray Hand Knit Wool Socks').getByRole('link', { name: 'Gray Hand Knit Wool Socks' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gray Hand Knit Wool Socks' })).toBeVisible();
});

test('a sold out product cannot be added, and the cart holds no more than is in stock', async ({ page }) => {
  await page.goto('/');

  const hat = productCard(page, 'Straw Wide Brim Sun Hat');
  await expect(hat.getByTestId('stock-note')).toHaveText('Out of stock');
  await expect(hat.getByTestId('add-to-cart-button')).toBeDisabled();

  // The tote bag starts with 2 left
  await addToCart(page, 'Woven Straw Tote Bag', 2);
  await productCard(page, 'Woven Straw Tote Bag').getByTestId('add-to-cart-button').click();
  await expect(page.getByRole('alert', { name: 'Errors' })).toContainText('Only 2 of Woven Straw Tote Bag left in stock. You already have 2 in your cart.');
  await expect(page.getByTestId('header-cart-link')).toHaveAccessibleName('Cart, 2 items');
});
