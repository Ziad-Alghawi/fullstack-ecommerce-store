function formatWith(options: Intl.DateTimeFormatOptions) {
  return (date: number | string, locale: string) => new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

// Sunday, May 18
export const formatDeliveryDate = formatWith({ weekday: 'long', month: 'long', day: 'numeric' });

// May 18, 2025
export const formatDate = formatWith({ dateStyle: 'long' });

// May 18
export const formatDayAndMonth = formatWith({ month: 'long', day: 'numeric' });

// May 18, 2025, 9:30 AM
export const formatDateTime = formatWith({ dateStyle: 'medium', timeStyle: 'short' });
