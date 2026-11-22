// The store's one public address, like https://shop.example.com, without a path or a trailing slash.
// Empty when PUBLIC_SITE_URL isn't set, as in local runs, where the store works from whatever address it is opened on
function readPublicSiteUrl(value: string | undefined) {
  if (!value) {
    return '';
  }
  const url = URL.parse(value);
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`PUBLIC_SITE_URL must be a web address like https://shop.example.com, not "${value}"`);
  }
  return url.origin;
}

export const publicSiteUrl = readPublicSiteUrl(process.env.PUBLIC_SITE_URL?.trim());
