'use client';

import { useMemo, type ReactNode } from 'react';
import { Switch } from 'antd';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { chatUi } from '@/lib/chatUiCopy';
import { TTS_VOICES } from '@/lib/ttsVoices';
import type { AppTheme } from '@/types/appSettings';
import { TtsVoicePicker } from '@/components/settings/TtsVoicePicker';

type AppSettingsFormProps = {
  languageHint?: string;
};

function ChoiceCard({
  selected,
  onClick,
  title,
  description,
  preview,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  preview?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={
        selected
          ? 'app-settings-choice app-settings-choice--selected'
          : 'app-settings-choice'
      }
    >
      {preview ? <div className="app-settings-choice-preview" aria-hidden>{preview}</div> : null}
      <div className="min-w-0 text-left">
        <div className="app-settings-choice-title">{title}</div>
        {description ? <div className="app-settings-choice-desc">{description}</div> : null}
      </div>
    </button>
  );
}

export function AppSettingsForm({ languageHint }: AppSettingsFormProps) {
  const { settings, setLocale, setTheme, setTextOnlyReplies, setSpeechEnabled, setTtsVoice } =
    useAppSettings();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);

  const voiceOptions = useMemo(() => {
    return TTS_VOICES[settings.ttsLang].map((voice) => ({
      value: voice.id,
      label: settings.locale === 'en' ? voice.labelEn : voice.labelRu,
    }));
  }, [settings.ttsLang, settings.locale]);

  return (
    <div className="app-settings-panel space-y-8">
      <section className="space-y-3">
        <div>
          <div className="app-settings-label">{ui('language')}</div>
          {languageHint ? <p className="app-settings-hint mt-1">{languageHint}</p> : null}
        </div>
        <div className="app-settings-choice-grid" role="listbox" aria-label={ui('language')}>
          <ChoiceCard
            selected={settings.locale === 'ru'}
            onClick={() => setLocale('ru')}
            title={ui('languageRu')}
            preview={<span className="app-settings-lang-badge">RU</span>}
          />
          <ChoiceCard
            selected={settings.locale === 'en'}
            onClick={() => setLocale('en')}
            title={ui('languageEn')}
            preview={<span className="app-settings-lang-badge">EN</span>}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="app-settings-label">{ui('theme')}</div>
        <div className="app-settings-choice-grid" role="listbox" aria-label={ui('theme')}>
          <ChoiceCard
            selected={settings.theme === 'leo-dark'}
            onClick={() => setTheme('leo-dark' as AppTheme)}
            title={ui('themeLeo')}
            description={ui('themeLeoHint')}
            preview={
              <span className="app-settings-theme-swatch app-settings-theme-swatch--leo">
                <span />
                <span />
                <span />
              </span>
            }
          />
          <ChoiceCard
            selected={settings.theme === 'hume-light'}
            onClick={() => setTheme('hume-light' as AppTheme)}
            title={ui('themeHume')}
            description={ui('themeHumeHint')}
            preview={
              <span className="app-settings-theme-swatch app-settings-theme-swatch--hume">
                <span />
                <span />
                <span />
              </span>
            }
          />
        </div>
      </section>

      <section className="app-settings-toggles space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="app-settings-label">{ui('textOnlyReplies')}</div>
            <p className="app-settings-hint mt-1">{ui('textOnlyRepliesHint')}</p>
          </div>
          <Switch checked={settings.textOnlyReplies} onChange={setTextOnlyReplies} />
        </div>

        {!settings.textOnlyReplies ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="app-settings-label">{ui('speech')}</div>
              <p className="app-settings-hint mt-1">{ui('speechHint')}</p>
            </div>
            <Switch checked={settings.speechEnabled} onChange={setSpeechEnabled} />
          </div>
        ) : null}

        {!settings.textOnlyReplies && settings.speechEnabled ? (
          <div className="space-y-3">
            <div className="app-settings-label">{ui('ttsVoice')}</div>
            <TtsVoicePicker
              ariaLabel={ui('ttsVoice')}
              value={settings.ttsVoice}
              onChange={setTtsVoice}
              options={voiceOptions}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
