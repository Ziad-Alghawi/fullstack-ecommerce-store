import { en, type Messages } from './en';
import { de } from './de';
import { formatMoney } from '../utils/money';
import { formatDate, formatDateTime, formatDayAndMonth, formatDeliveryDate } from '../utils/date';
import { readStorage, writeStorage } from '../utils/storage';
import type { ApiError } from '../types/store';

export const LANGUAGES = {
  en: { name: 'English', locale: 'en-US', messages: en },
  de: { name: 'Deutsch', locale: 'de-DE', messages: de }
} satisfies Record<string, { name: string; locale: string; messages: Messages }>;

export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[];

const STORAGE_KEY = 'language';

function hasKey<T extends object>(object: T, key: PropertyKey | null | undefined): key is keyof T {
  return key !== null && key !== undefined && Object.prototype.hasOwnProperty.call(object, key);
}

// The saved choice, or else the first of the browser's languages that the store speaks
export function getInitialLanguage(): Language {
  const saved = readStorage(STORAGE_KEY);
  if (hasKey(LANGUAGES, saved)) {
    return saved;
  }
  const preferred = navigator.languages.map((tag) => tag.slice(0, 2).toLowerCase()).find((tag) => hasKey(LANGUAGES, tag));
  return preferred ?? 'en';
}

export function saveLanguage(language: Language) {
  writeStorage(STORAGE_KEY, language);
}

export function createI18n(language: Language) {
  const { locale, messages: t } = LANGUAGES[language];

  return {
    language,
    t,
    formatMoney: (amountCents: number) => formatMoney(amountCents, locale),
    formatNumber: (value: number) => value.toLocaleString(locale),
    formatDate: (date: string) => formatDate(date, locale),
    formatDayAndMonth: (timeMs: number) => formatDayAndMonth(timeMs, locale),
    formatDateTime: (timeMs: number) => formatDateTime(timeMs, locale),
    formatDeliveryDate: (timeMs: number) => formatDeliveryDate(timeMs, locale),
    // Categories are stored in English. One the store doesn't know keeps its name
    categoryName: (category: string) => (hasKey(t.categories, category) ? t.categories[category] : category),
    // The API's reason for refusing a request, in this language when it sent a code the store knows
    apiError: (data: ApiError | null | undefined) => {
      const { code, error, params = {} } = data ?? {};
      return hasKey(t.apiErrors, code) ? t.apiErrors[code](params) : error ?? null;
    },
    authError: ({ code, message }: { code?: string; message: string }) => (hasKey(t.authErrors, code) ? t.authErrors[code] : message)
  };
}

export type I18n = ReturnType<typeof createI18n>;
