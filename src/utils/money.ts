// Prices are always in US dollars. Only how they're written follows the language
export function formatMoney(amountCents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amountCents / 100);
}
