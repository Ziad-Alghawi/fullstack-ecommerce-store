// The address the store is public at, which the server puts in a meta tag of index.html.
// Without one (the dev server, or no PUBLIC_SITE_URL), it's the address the page is opened on
export function getSiteUrl() {
  const content = document.querySelector<HTMLMetaElement>('meta[name="public-site-url"]')?.content;
  return content && URL.canParse(content) ? new URL(content).origin : window.location.origin;
}
