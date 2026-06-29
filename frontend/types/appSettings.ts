import {
  DEFAULT_TTS_LANG,
  DEFAULT_TTS_VOICE,
  type TtsLang,
} from '@/lib/ttsVoices';

export type AppLocale = 'ru' | 'en';

export type AppTheme = 'leo-dark' | 'hume-light';

export type AppSettings = {
  locale: AppLocale;
  theme: AppTheme;
  speechEnabled: boolean;
  ttsLang: TtsLang;
  ttsVoice: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  locale: 'ru',
  theme: 'leo-dark',
  speechEnabled: true,
  ttsLang: DEFAULT_TTS_LANG,
  ttsVoice: DEFAULT_TTS_VOICE,
};
