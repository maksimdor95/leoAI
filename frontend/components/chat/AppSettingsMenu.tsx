'use client';

import { useMemo } from 'react';
import { SettingOutlined } from '@ant-design/icons';
import { Button, Popover, Segmented, Select, Switch, Tooltip } from 'antd';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { chatUi } from '@/lib/chatUiCopy';
import { landingSettingsChipLabel, landingUi } from '@/lib/landingUiCopy';
import { TTS_VOICES } from '@/lib/ttsVoices';
import type { AppLocale, AppTheme } from '@/types/appSettings';
import { useHumeTheme } from '@/lib/useHumeTheme';

type AppSettingsMenuProps = {
  variant?: 'icon' | 'pill';
  /** Landing/legal: language + theme only (no speech or voice). */
  scope?: 'full' | 'landing';
};

export function AppSettingsMenu({ variant = 'icon', scope = 'full' }: AppSettingsMenuProps) {
  const { settings, setLocale, setTheme, setSpeechEnabled, setTtsVoice } = useAppSettings();
  const isHume = useHumeTheme();
  const isLandingScope = scope === 'landing';
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const landing = landingUi(settings.locale);

  const voiceOptions = useMemo(() => {
    if (isLandingScope) return [];
    return TTS_VOICES[settings.ttsLang].map((voice) => ({
      value: voice.id,
      label: settings.locale === 'en' ? voice.labelEn : voice.labelRu,
    }));
  }, [isLandingScope, settings.ttsLang, settings.locale]);

  const content = (
    <div className="app-settings-panel w-[min(100vw-2rem,18rem)] space-y-4 p-1">
      <div className="space-y-2">
        <div className="app-settings-label">{ui('language')}</div>
        <p className="app-settings-hint">
          {isLandingScope ? landing.settingsLanguageHint : ui('languageHint')}
        </p>
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

      {!isLandingScope ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="app-settings-label">{ui('speech')}</div>
              <p className="app-settings-hint">{ui('speechHint')}</p>
            </div>
            <Switch checked={settings.speechEnabled} onChange={setSpeechEnabled} />
          </div>

          {settings.speechEnabled ? (
            <div className="space-y-2">
              <div className="app-settings-label">{ui('ttsVoice')}</div>
              <Select
                showSearch
                optionFilterProp="label"
                className="app-settings-select w-full"
                value={settings.ttsVoice}
                onChange={setTtsVoice}
                options={voiceOptions}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );

  const iconTrigger = (
    <Button
      type="text"
      size={isLandingScope ? 'large' : 'small'}
      icon={
        <SettingOutlined
          aria-hidden
          style={isLandingScope ? { fontSize: 22 } : undefined}
        />
      }
      className={
        isHume
          ? `app-settings-trigger leo-chat-header-btn !text-[var(--color-ink)] hover:!bg-[rgba(34,34,34,0.04)] ${
              isLandingScope ? '!h-11 !w-11 !min-w-[2.75rem] !rounded-full' : 'text-xs sm:text-sm'
            }`
          : `app-settings-trigger !text-slate-200 hover:!text-green-300 hover:!bg-white/[0.06] ${
              isLandingScope ? '!h-11 !w-11 !min-w-[2.75rem] !rounded-full' : 'text-xs sm:text-sm'
            }`
      }
      aria-label={ui('settings')}
    />
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      overlayClassName="app-settings-popover"
    >
      {variant === 'pill' ? (
        <button
          type="button"
          className={
            isHume
              ? 'inline-flex items-center gap-2 rounded-full border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] px-3.5 py-2 text-xs font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bone)]'
              : 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-green-200/95 backdrop-blur transition-colors hover:border-green-400/25 hover:bg-white/[0.07]'
          }
          aria-label={ui('settings')}
        >
          <SettingOutlined aria-hidden className="text-[13px] opacity-70" />
          {landingSettingsChipLabel(settings.locale, isHume)}
        </button>
      ) : isLandingScope ? (
        iconTrigger
      ) : (
        <Tooltip title={ui('settings')}>{iconTrigger}</Tooltip>
      )}
    </Popover>
  );
}
