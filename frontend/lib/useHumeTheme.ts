'use client';

import { useAppSettings } from '@/contexts/AppSettingsContext';

export function useHumeTheme(): boolean {
  const { settings } = useAppSettings();
  return settings.theme === 'hume-light';
}
