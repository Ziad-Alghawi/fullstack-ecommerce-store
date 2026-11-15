// Whether a search text is in a product's name or one of its keywords, ignoring case
export function matchesSearch(product, search) {
  const lowerCaseSearch = search.toLowerCase();
  return product.name.toLowerCase().includes(lowerCaseSearch)
    || product.keywords.some((keyword) => keyword.toLowerCase().includes(lowerCaseSearch));
}
