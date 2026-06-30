import type { AppLocale, AppSettings, AppTheme } from '@/types/appSettings';

export const APP_THEME_COOKIE = 'leo.app.theme';
export const APP_LOCALE_COOKIE = 'leo.app.locale';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type DocumentDataTheme = 'hume' | 'leo-dark';

export function dataThemeFromCookie(value: string | undefined): DocumentDataTheme {
  return value === 'hume' ? 'hume' : 'leo-dark';
}

export function themeToCookieValue(theme: AppTheme): DocumentDataTheme {
  return theme === 'hume-light' ? 'hume' : 'leo-dark';
}

export function localeFromCookie(value: string | undefined): AppLocale {
  return value === 'en' ? 'en' : 'ru';
}

/** Client-only: keep cookie in sync with localStorage for SSR theme on refresh. */
export function writeThemeCookies(settings: Pick<AppSettings, 'theme' | 'locale'>): void {
  if (typeof document === 'undefined') return;

  const secure = window.location.protocol === 'https:' ? ';secure' : '';
  const base = `path=/;max-age=${COOKIE_MAX_AGE_SECONDS};samesite=lax${secure}`;

  document.cookie = `${APP_THEME_COOKIE}=${themeToCookieValue(settings.theme)};${base}`;
  document.cookie = `${APP_LOCALE_COOKIE}=${settings.locale};${base}`;
}
