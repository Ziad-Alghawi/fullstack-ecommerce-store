import { expect, test } from '@playwright/test';
import { productCard } from './helpers.ts';

test('a visitor switches to German, which stays after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Deutsch' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Alltägliches, direkt geliefert' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('navigation', { name: 'Kategorien' }).getByRole('link', { name: 'Sport' })).toBeVisible();
  await expect(productCard(page, 'Intermediate Size Basketball')).toContainText('20,95 $');

  // The API's reason comes with a code, so it's shown in German too. The tote bag starts with 2 left
  const tote = productCard(page, 'Woven Straw Tote Bag');
  await tote.getByLabel('Menge von Woven Straw Tote Bag').selectOption('2');
  await tote.getByTestId('add-to-cart-button').click();
  await expect(page.getByTestId('header-cart-link')).toHaveAccessibleName('Warenkorb, 2 Artikel');
  await tote.getByTestId('add-to-cart-button').click();
  await expect(page.getByRole('alert', { name: 'Fehler' }))
    .toContainText('Von Woven Straw Tote Bag sind nur noch 2 da. Du hast schon 2 im Warenkorb.');

  await page.goto('/page-that-does-not-exist');
  await expect(page.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeVisible();
  await expect(page).toHaveTitle('Seite nicht gefunden | Ziad-Alghawi Store');

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
});

test.describe('with a German browser', () => {
  test.use({ locale: 'de-DE' });

  test('starts in German and explains a form field in German', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Bestellung prüfen' })).toBeVisible();

    await page.goto('/login');
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('login-email-input')).toHaveJSProperty('validationMessage', 'Bitte fülle dieses Feld aus.');
  });
});
