import { afterEach, describe, expect, it } from 'vitest';
import { getSiteUrl } from './siteUrl';

function setMeta(content: string) {
  document.head.insertAdjacentHTML('beforeend', `<meta name="public-site-url" content="${content}">`);
}

describe('getSiteUrl', () => {
  afterEach(() => {
    document.head.querySelector('meta[name="public-site-url"]')?.remove();
  });

  it('is the public address the server filled in', () => {
    setMeta('https://shop.example.com');
    expect(getSiteUrl()).toBe('https://shop.example.com');
  });

  it('is the address of the page without one', () => {
    expect(getSiteUrl()).toBe(window.location.origin);
  });

  it('ignores an empty tag and one the server never filled in', () => {
    setMeta('');
    expect(getSiteUrl()).toBe(window.location.origin);
    document.head.querySelector('meta[name="public-site-url"]')?.remove();
    setMeta('%SITE_URL%');
    expect(getSiteUrl()).toBe(window.location.origin);
  });
});
