import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIndexHtml } from '../utils/indexHtml.js';

const html = [
  '<head>',
  '<link rel="canonical" href="%SITE_URL%%PATH%" />',
  '<meta property="og:image" content="%SITE_URL%/og-image.jpg" />',
  '<meta name="public-site-url" content="%SITE_URL%" />',
  '</head>'
].join('\n');

test('fills in the public address and the canonical link of the page', () => {
  const page = renderIndexHtml(html, 'https://shop.example.com', '/products/abc');
  assert.match(page, /<link rel="canonical" href="https:\/\/shop.example.com\/products\/abc" \/>/);
  assert.match(page, /content="https:\/\/shop.example.com\/og-image.jpg"/);
  assert.match(page, /name="public-site-url" content="https:\/\/shop.example.com"/);
  assert.doesNotMatch(page, /%/);
});

test('leaves out the tags that need a full URL without a public address', () => {
  const page = renderIndexHtml(html, '', '/');
  assert.doesNotMatch(page, /canonical/);
  assert.match(page, /content="\/og-image.jpg"/);
  assert.match(page, /name="public-site-url" content=""/);
});

test('keeps a path from breaking out of the attribute it is written in', () => {
  const page = renderIndexHtml(html, 'https://shop.example.com', '/"><script>alert(1)</script>&x');
  assert.doesNotMatch(page, /<script>/);
  assert.match(page, /href="https:\/\/shop.example.com\/%22%3E%3Cscript%3Ealert\(1\)%3C\/script%3E&amp;x"/);
});
