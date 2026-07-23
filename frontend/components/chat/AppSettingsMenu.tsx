'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Switch } from 'antd';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { chatUi } from '@/lib/chatUiCopy';
import { landingSettingsChipLabel } from '@/lib/landingUiCopy';
import { TTS_VOICES } from '@/lib/ttsVoices';
import { useHumeTheme } from '@/lib/useHumeTheme';
import { AppSettingsForm } from '@/components/settings/AppSettingsForm';
import { TtsVoicePicker } from '@/components/settings/TtsVoicePicker';

type AppSettingsMenuProps = {
  variant?: 'icon' | 'pill';
};

const OVERLAY_Z = 'z-[2500]';

export function AppSettingsMenu({ variant = 'icon' }: AppSettingsMenuProps) {
  const { settings, setTextOnlyReplies, setSpeechEnabled, setTtsVoice } = useAppSettings();
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

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
          <div className="app-settings-label">{ui('textOnlyReplies')}</div>
          <p className="app-settings-hint">{ui('textOnlyRepliesHint')}</p>
        </div>
        <Switch checked={settings.textOnlyReplies} onChange={setTextOnlyReplies} />
      </div>

      {!settings.textOnlyReplies ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="app-settings-label">{ui('speech')}</div>
            <p className="app-settings-hint">{ui('speechHint')}</p>
          </div>
          <Switch checked={settings.speechEnabled} onChange={setSpeechEnabled} />
        </div>
      ) : null}

      {!settings.textOnlyReplies && settings.speechEnabled ? (
        <div className="space-y-2">
          <div className="app-settings-label">{ui('ttsVoice')}</div>
          <TtsVoicePicker
            ariaLabel={ui('ttsVoice')}
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
            <div className="pointer-events-none absolute inset-0 flex items-stretch justify-center sm:items-center sm:p-4">
              <div
                className={`support-widget-panel app-settings-dialog pointer-events-auto flex w-full flex-col border shadow-2xl shadow-black/70 ${
                  isHume
                    ? 'border-[rgba(34,34,34,0.12)]'
                    : 'border-white/10 bg-[#0a0f1e] ring-1 ring-white/[0.06]'
                } h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-y-contain rounded-none p-5 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:h-fit sm:max-h-[90dvh] sm:w-[min(100vw-2rem,28rem)] sm:rounded-2xl sm:p-6`}
                role="dialog"
                aria-modal="true"
                aria-label={ui('settings')}
              >
                <div className="support-widget-divider flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div
                    className={`support-widget-title text-base font-semibold sm:text-lg ${isHume ? '' : 'text-white'}`}
                  >
                    {ui('settings')}
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label={settings.locale === 'en' ? 'Close' : 'Закрыть'}
                    className={`app-settings-close-btn inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none outline-none transition-colors focus:outline-none focus-visible:outline-none ${
                      isHume
                        ? 'text-[var(--color-smoke)] hover:bg-[rgba(34,34,34,0.06)] hover:text-[var(--color-ink)]'
                        : 'text-slate-400 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <CloseOutlined className="text-[13px] leading-none" aria-hidden />
                  </button>
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
      onClick={toggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={
        isHume
          ? 'app-settings-trigger leo-chat-header-btn !text-[var(--color-ink)] hover:!bg-[rgba(34,34,34,0.04)] text-xs sm:text-sm'
          : 'app-settings-trigger !text-slate-200 hover:!text-green-300 hover:!bg-white/[0.06] text-xs sm:text-sm'
      }
      aria-label={ui('settings')}
    >
      {ui('settings')}
    </Button>
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
