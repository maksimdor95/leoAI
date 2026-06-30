'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SettingOutlined } from '@ant-design/icons';
import { Button, Select, Switch } from 'antd';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { chatUi } from '@/lib/chatUiCopy';
import { landingSettingsChipLabel } from '@/lib/landingUiCopy';
import { TTS_VOICES } from '@/lib/ttsVoices';
import { useHumeTheme } from '@/lib/useHumeTheme';
import { AppSettingsForm } from '@/components/settings/AppSettingsForm';

type AppSettingsMenuProps = {
  variant?: 'icon' | 'pill';
};

const SETTINGS_PANEL_CLASS =
  'support-widget-panel app-settings-dialog w-[min(100vw-2.5rem,18rem)] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-white/10 bg-[#0a0f1e] p-5 shadow-2xl shadow-black/70 ring-1 ring-white/[0.06]';

const OVERLAY_Z = 'z-[2500]';

export function AppSettingsMenu({ variant = 'icon' }: AppSettingsMenuProps) {
  const { settings, setSpeechEnabled, setTtsVoice } = useAppSettings();
  const isHume = useHumeTheme();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const voiceOptions = useMemo(() => {
    return TTS_VOICES[settings.ttsLang].map((voice) => ({
      value: voice.id,
      label: settings.locale === 'en' ? voice.labelEn : voice.labelRu,
    }));
  }, [settings.ttsLang, settings.locale]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  const toggle = () => {
    setOpen((prev) => !prev);
  };

  const panelContent = (
    <div className="space-y-4">
      <AppSettingsForm languageHint={ui('languageHint')} />

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
    </div>
  );

  const settingsLayer =
    open && mounted
      ? createPortal(
          <div className={`fixed inset-0 ${OVERLAY_Z}`}>
            <button
              type="button"
              className={`support-widget-overlay absolute inset-0 ${
                isHume ? 'bg-[#222]/25 backdrop-blur-[2px]' : 'bg-[#050913]/75 backdrop-blur-[2px]'
              }`}
              onClick={close}
              aria-label={ui('settings')}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <div
                className={`${SETTINGS_PANEL_CLASS} pointer-events-auto`}
                role="dialog"
                aria-modal="true"
                aria-label={ui('settings')}
              >
                <div className="support-widget-divider border-b border-white/10 pb-3">
                  <div
                    className={`support-widget-title text-base font-semibold ${isHume ? '' : 'text-white'}`}
                  >
                    {ui('settings')}
                  </div>
                </div>
                <div className="mt-4">{panelContent}</div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const iconTrigger = (
    <Button
      type="text"
      size="small"
      icon={<SettingOutlined aria-hidden />}
      onClick={toggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={
        isHume
          ? 'app-settings-trigger leo-chat-header-btn !text-[var(--color-ink)] hover:!bg-[rgba(34,34,34,0.04)] text-xs sm:text-sm'
          : 'app-settings-trigger !text-slate-200 hover:!text-green-300 hover:!bg-white/[0.06] text-xs sm:text-sm'
      }
      aria-label={ui('settings')}
    />
  );

  return (
    <>
      {variant === 'pill' ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
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
      ) : (
        iconTrigger
      )}
      {settingsLayer}
    </>
  );
}
