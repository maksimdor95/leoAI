export type TtsLang = 'ru-RU' | 'en-US';

export type TtsVoiceOption = {
  id: string;
  labelRu: string;
  labelEn: string;
};

/** Голоса SpeechKit API v1 (`speech/v1/tts:synthesize`). v3-only (dasha, julia, lera, alexander, madi) не включаем. */
export const TTS_VOICES: Record<TtsLang, TtsVoiceOption[]> = {
  'ru-RU': [
    { id: 'ermil', labelRu: 'Ермил', labelEn: 'Ermil' },
    { id: 'filipp', labelRu: 'Филипп', labelEn: 'Filipp' },
    { id: 'jane', labelRu: 'Джейн', labelEn: 'Jane' },
    { id: 'omazh', labelRu: 'Омаж', labelEn: 'Omazh' },
    { id: 'zahar', labelRu: 'Захар', labelEn: 'Zahar' },
    { id: 'marina', labelRu: 'Марина', labelEn: 'Marina' },
  ],
  'en-US': [
    { id: 'ermil', labelRu: 'Ермил', labelEn: 'Ermil' },
    { id: 'jane', labelRu: 'Джейн', labelEn: 'Jane' },
    { id: 'omazh', labelRu: 'Омаж', labelEn: 'Omazh' },
    { id: 'zahar', labelRu: 'Захар', labelEn: 'Zahar' },
    { id: 'alyss', labelRu: 'Алис', labelEn: 'Alyss' },
    { id: 'oksana', labelRu: 'Оксана', labelEn: 'Oksana' },
    { id: 'nick', labelRu: 'Ник', labelEn: 'Nick' },
  ],
};

export const DEFAULT_TTS_LANG: TtsLang = 'ru-RU';
export const DEFAULT_TTS_VOICE = 'ermil';

export type TtsPreferences = {
  lang: TtsLang;
  voice: string;
};

export type ClientPreferences = TtsPreferences & {
  locale: import('@/types/appSettings').AppLocale;
};

export function getDefaultTtsVoice(lang: TtsLang): string {
  return lang === 'ru-RU' ? DEFAULT_TTS_VOICE : 'jane';
}

export function isValidTtsVoice(lang: TtsLang, voice: string): boolean {
  return TTS_VOICES[lang].some((item) => item.id === voice);
}

export function normalizeTtsVoice(lang: TtsLang, voice: string | undefined): string {
  if (voice && isValidTtsVoice(lang, voice)) {
    return voice;
  }
  return getDefaultTtsVoice(lang);
}

export function normalizeTtsLang(raw: unknown): TtsLang {
  return raw === 'en-US' ? 'en-US' : 'ru-RU';
}

export function localeToTtsLang(locale: 'ru' | 'en'): TtsLang {
  return locale === 'en' ? 'en-US' : 'ru-RU';
}

export function getTtsVoiceLabel(
  lang: TtsLang,
  voiceId: string,
  uiLocale: 'ru' | 'en'
): string {
  const voice = TTS_VOICES[lang].find((item) => item.id === voiceId);
  if (!voice) return voiceId;
  return uiLocale === 'en' ? voice.labelEn : voice.labelRu;
}
