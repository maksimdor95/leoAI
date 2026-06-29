'use client';

import { useEffect } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';

/** Sync `<html lang>` with app locale on client routes. */
export function DocumentLangSync() {
  const { settings } = useAppSettings();

  useEffect(() => {
    document.documentElement.lang = settings.locale === 'en' ? 'en' : 'ru';
  }, [settings.locale]);

  return null;
}
