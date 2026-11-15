// The store sells in euros only. How a price is written follows the language
export function formatMoney(amountCents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amountCents / 100);
}
