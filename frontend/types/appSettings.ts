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
  /** Ответы сразу текстом: без озвучки и без анимации печати. */
  textOnlyReplies: boolean;
  speechEnabled: boolean;
  ttsLang: TtsLang;
  ttsVoice: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  locale: 'ru',
  theme: 'leo-dark',
  textOnlyReplies: false,
  speechEnabled: true,
  ttsLang: DEFAULT_TTS_LANG,
  ttsVoice: DEFAULT_TTS_VOICE,
};
