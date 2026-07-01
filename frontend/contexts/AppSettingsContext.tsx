'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readAppSettings, writeAppSettings } from '@/lib/appSettingsStorage';
import {
  DEFAULT_APP_SETTINGS,
  type AppLocale,
  type AppSettings,
  type AppTheme,
} from '@/types/appSettings';
import { localeToTtsLang, normalizeTtsVoice } from '@/lib/ttsVoices';
import { writeThemeCookies } from '@/lib/appThemeCookie';

type AppSettingsProviderProps = {
  children: ReactNode;
  initialSettings?: AppSettings;
};

type AppSettingsContextValue = {
  settings: AppSettings;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: AppTheme) => void;
  setSpeechEnabled: (enabled: boolean) => void;
  setTtsVoice: (voice: string) => void;
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function applySettingsToDocument(settings: AppSettings): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = settings.locale;
  document.documentElement.dataset.theme =
    settings.theme === 'hume-light' ? 'hume' : 'leo-dark';
  writeThemeCookies(settings);
}

export function AppSettingsProvider({
  children,
  initialSettings = DEFAULT_APP_SETTINGS,
}: AppSettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window === 'undefined') return initialSettings;
    const stored = readAppSettings();
    applySettingsToDocument(stored);
    return stored;
  });

  useEffect(() => {
    const stored = readAppSettings();
    setSettings((prev) => {
      const unchanged =
        prev.locale === stored.locale &&
        prev.theme === stored.theme &&
        prev.speechEnabled === stored.speechEnabled &&
        prev.ttsLang === stored.ttsLang &&
        prev.ttsVoice === stored.ttsVoice;
      if (unchanged) return prev;
      applySettingsToDocument(stored);
      return stored;
    });
  }, []);

  const persist = useCallback((updater: AppSettings | ((prev: AppSettings) => AppSettings)) => {
    setSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeAppSettings(next);
      applySettingsToDocument(next);
      return next;
    });
  }, []);

  const setLocale = useCallback(
    (locale: AppLocale) => {
      persist((prev) => {
        const ttsLang = localeToTtsLang(locale);
        return {
          ...prev,
          locale,
          ttsLang,
          ttsVoice: normalizeTtsVoice(ttsLang, prev.ttsVoice),
        };
      });
    },
    [persist]
  );

  const setTheme = useCallback(
    (theme: AppTheme) => {
      persist((prev) => ({ ...prev, theme }));
    },
    [persist]
  );

  const setSpeechEnabled = useCallback(
    (speechEnabled: boolean) => {
      persist((prev) => ({ ...prev, speechEnabled }));
    },
    [persist]
  );

  const setTtsVoice = useCallback(
    (ttsVoice: string) => {
      persist((prev) => ({
        ...prev,
        ttsVoice: normalizeTtsVoice(prev.ttsLang, ttsVoice),
      }));
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      settings,
      setLocale,
      setTheme,
      setSpeechEnabled,
      setTtsVoice,
    }),
    [settings, setLocale, setTheme, setSpeechEnabled, setTtsVoice]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }
  return ctx;
}
