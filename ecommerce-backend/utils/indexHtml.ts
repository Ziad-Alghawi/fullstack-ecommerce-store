const escapeAttribute = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

// Fills in the store's public address in the built index.html: in the link preview tags, the canonical
// link of the page asked for, and a tag the frontend reads. Without an address, the tags that need a full URL are left out
export function renderIndexHtml(html: string, siteUrl: string, pathname: string) {
  const lines = html.split('\n').filter((line) => siteUrl || !line.includes('%PATH%'));
  return lines.join('\n')
    .replaceAll('%PATH%', escapeAttribute(encodeURI(pathname)))
    .replaceAll('%SITE_URL%', escapeAttribute(siteUrl));
}
