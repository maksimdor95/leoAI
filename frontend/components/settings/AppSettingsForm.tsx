'use client';

import { Segmented } from 'antd';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { chatUi } from '@/lib/chatUiCopy';
import type { AppLocale, AppTheme } from '@/types/appSettings';

type AppSettingsFormProps = {
  languageHint?: string;
};

export function AppSettingsForm({ languageHint }: AppSettingsFormProps) {
  const { settings, setLocale, setTheme } = useAppSettings();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);

  return (
    <div className="app-settings-panel space-y-6">
      <div className="space-y-2">
        <div className="app-settings-label">{ui('language')}</div>
        {languageHint ? <p className="app-settings-hint">{languageHint}</p> : null}
        <Segmented
          block
          value={settings.locale}
          onChange={(value) => setLocale(value as AppLocale)}
          options={[
            { label: ui('languageRu'), value: 'ru' },
            { label: ui('languageEn'), value: 'en' },
          ]}
          className="app-settings-segmented"
        />
      </div>

      <div className="space-y-2">
        <div className="app-settings-label">{ui('theme')}</div>
        <Segmented
          block
          value={settings.theme}
          onChange={(value) => setTheme(value as AppTheme)}
          options={[
            { label: ui('themeLeo'), value: 'leo-dark' },
            { label: ui('themeHume'), value: 'hume-light' },
          ]}
          className="app-settings-segmented"
        />
      </div>
    </div>
  );
}
