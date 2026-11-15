import { expect, test, type Page } from '@playwright/test';
import { expectNoViolations } from './helpers.ts';

async function askForSocks(page: Page, question: string) {
  await page.getByTestId('chat-input').fill(question);
  await page.keyboard.press('Enter');
}

test('a visitor asks the assistant for socks and adds them to the cart from the chat', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask our assistant' }).click();
  await expect(page.getByLabel('Your message')).toBeFocused();

  await askForSocks(page, 'Do you have socks under 15 euros?');
  await expect(page.getByTestId('chat-assistant-message')).toContainText('Here are some socks.');
  const card = page.getByTestId('chat-panel').getByTestId('product-container').first();
  await expect(card).toContainText('Gray Hand Knit Wool Socks');
  await expect(card).toContainText('€10.90');
  await expectNoViolations(page);

  await card.getByTestId('add-to-cart-button').click();
  await expect(page.getByTestId('header-cart-link')).toHaveAccessibleName('Cart, 1 item');

  // The name links to the product's page, which closes the chat
  await card.getByRole('link', { name: 'Gray Hand Knit Wool Socks' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gray Hand Knit Wool Socks' })).toBeVisible();
  await expect(page.getByTestId('chat-panel')).toBeHidden();
});

test('works from the keyboard, in German', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Deutsch' }).click();

  const toggle = page.getByRole('button', { name: 'Assistent fragen' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Einkaufsassistent' })).toBeVisible();
  await expectNoViolations(page);

  await askForSocks(page, 'Habt ihr Socken?');
  await expect(page.getByTestId('chat-assistant-message')).toContainText('Hier sind Socken.');
  await expect(page.getByTestId('chat-panel').getByTestId('product-container').first()).toContainText('10,90');

  await page.getByTestId('chat-input').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('chat-panel')).toBeHidden();
  await expect(toggle).toBeFocused();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`on a phone, in ${colorScheme} mode`, () => {
    test.use({ viewport: { width: 375, height: 700 }, isMobile: true, colorScheme });

    test('the chat fits the screen and passes an accessibility check', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('chat-toggle').click();
      await askForSocks(page, 'Do you have socks?');
      await expect(page.getByTestId('chat-panel').getByTestId('product-container').first()).toBeVisible();

      // The page has no horizontal scroll
      expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
      const box = await page.getByTestId('chat-panel').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
      await expectNoViolations(page);
    });
  });
}
