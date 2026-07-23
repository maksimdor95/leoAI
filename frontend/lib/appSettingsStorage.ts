import { DEFAULT_APP_SETTINGS, type AppSettings } from '@/types/appSettings';
import { localeToTtsLang, normalizeTtsVoice } from '@/lib/ttsVoices';
import { writeThemeCookies } from '@/lib/appThemeCookie';

const STORAGE_KEY = 'leo.app.settings.v1';

export const APP_SETTINGS_STORAGE_KEY = STORAGE_KEY;

export function readAppSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const locale = parsed.locale === 'en' ? 'en' : 'ru';
    const ttsLang = localeToTtsLang(locale);
    return {
      locale,
      theme: parsed.theme === 'hume-light' ? 'hume-light' : 'leo-dark',
      textOnlyReplies: parsed.textOnlyReplies === true,
      speechEnabled: parsed.speechEnabled !== false,
      ttsLang,
      ttsVoice: normalizeTtsVoice(ttsLang, parsed.ttsVoice),
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function writeAppSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  writeThemeCookies(settings);
}
