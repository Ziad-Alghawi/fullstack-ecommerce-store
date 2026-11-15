// @vitest-environment node
import { it, expect, describe } from 'vitest';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');

function readMeta(page: string, name: string) {
  return page.match(new RegExp(`<meta (?:name|property)="${name}"\\s+content="([^"]*)"`))?.[1];
}

// A baseline JPEG gives its size in the start of frame segment, after the bytes FF C0
function readJpegSize(file: string) {
  const bytes = fs.readFileSync(file);
  const start = bytes.indexOf(Buffer.from([0xff, 0xc0]));
  return { height: bytes.readUInt16BE(start + 5), width: bytes.readUInt16BE(start + 7), fileSize: bytes.length };
}

describe('link previews', () => {
  it('describe the store for search engines and link previews', () => {
    expect(readMeta(html, 'description')).toMatch(/demo store built with React/);
    expect(readMeta(html, 'og:title')).toBe('Full-Stack E-Commerce Store: everyday essentials, delivered');
    expect(readMeta(html, 'og:description')).toBe(readMeta(html, 'description'));
    expect(readMeta(html, 'og:image:alt')).toBeTruthy();
    expect(readMeta(html, 'twitter:card')).toBe('summary_large_image');
  });

  it('point to the preview image and the page itself with the address the server fills in', () => {
    expect(readMeta(html, 'og:image')).toBe('%SITE_URL%/og-image.jpg');
    expect(readMeta(html, 'og:url')).toBe('%SITE_URL%%PATH%');
    expect(html).toContain('<link rel="canonical" href="%SITE_URL%%PATH%" />');
    expect(readMeta(html, 'public-site-url')).toBe('%SITE_URL%');
  });

  it('use an image of the size LinkedIn and X show in full, under their 5 MB limit', () => {
    const { width, height, fileSize } = readJpegSize('public/og-image.jpg');

    expect({ width, height }).toEqual({ width: 1200, height: 630 });
    expect(readMeta(html, 'og:image:width')).toBe(String(width));
    expect(readMeta(html, 'og:image:height')).toBe(String(height));
    expect(fileSize).toBeLessThan(5 * 1024 * 1024);
  });
});
