import { it, expect, describe, vi, beforeEach, afterEach } from 'vitest';
import { createI18n, getInitialLanguage, saveLanguage } from './i18n';

describe('getInitialLanguage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the first browser language the store speaks', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'de-AT', 'en-US']);
    expect(getInitialLanguage()).toBe('de');
  });

  it('falls back to English', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    expect(getInitialLanguage()).toBe('en');
  });

  it('prefers the language the visitor chose', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    saveLanguage('de');
    expect(getInitialLanguage()).toBe('de');
  });

  it('ignores a saved value it does not know, and works without storage', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
    localStorage.setItem('language', 'xx');
    expect(getInitialLanguage()).toBe('de');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getInitialLanguage()).toBe('de');
  });
});

describe('createI18n', () => {
  const de = createI18n('de');
  const en = createI18n('en');

  it("translates the API's refusals that come with a code", () => {
    const refusal = { error: 'Only 2 of Tote Bag left in stock.', code: 'lowStock', params: { product: 'Tote Bag', stock: 2, inCart: 2 } };

    expect(en.apiError(refusal)).toBe('Only 2 of Tote Bag left in stock. You already have 2 in your cart.');
    expect(de.apiError(refusal)).toBe('Von Tote Bag sind nur noch 2 auf Lager. Du hast schon 2 im Warenkorb.');
  });

  it("falls back to the API's own message, and to nothing without one", () => {
    expect(de.apiError({ error: 'Image must be one of the product images', code: 'somethingNew' })).toBe('Image must be one of the product images');
    expect(de.apiError({ error: 'Name is required', code: 'toString' })).toBe('Name is required');
    expect(de.apiError(undefined)).toBeNull();
    expect(de.apiError(null)).toBeNull();
  });

  it('translates known Supabase errors and keeps the others', () => {
    expect(de.authError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('E-Mail oder Passwort ist falsch.');
    expect(de.authError({ code: 'unexpected', message: 'Something else' })).toBe('Something else');
    expect(de.authError({ message: 'No code' })).toBe('No code');
  });

  it('names the categories in the language, and keeps unknown ones', () => {
    expect(de.categoryName('Home & Kitchen')).toBe('Haushalt & Küche');
    expect(en.categoryName('Home & Kitchen')).toBe('Home & Kitchen');
    expect(de.categoryName('Garden')).toBe('Garden');
  });

  it('writes numbers the way the language does', () => {
    expect(en.formatNumber(1234.5)).toBe('1,234.5');
    expect(de.formatNumber(1234.5)).toBe('1.234,5');
  });
});
