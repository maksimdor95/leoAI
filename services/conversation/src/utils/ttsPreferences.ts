import { ConversationSession, ConversationSessionMetadata } from '../types/session';

export type TtsLang = 'ru-RU' | 'en-US';
export type UiLocale = 'ru' | 'en';

export interface TtsPreferencesInput {
  lang?: TtsLang;
  voice?: string;
}

export interface ClientPreferencesInput {
  uiLocale?: UiLocale;
  tts?: TtsPreferencesInput;
}

export function parseUiLocale(raw: unknown): UiLocale | undefined {
  return raw === 'en' ? 'en' : raw === 'ru' ? 'ru' : undefined;
}

export function parseTtsPreferences(raw: unknown): TtsPreferencesInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const result: TtsPreferencesInput = {};

  if (source.lang === 'ru-RU' || source.lang === 'en-US') {
    result.lang = source.lang;
  }

  if (typeof source.voice === 'string') {
    const voice = source.voice.trim().toLowerCase();
    if (voice) {
      result.voice = voice;
    }
  }

  return result.lang || result.voice ? result : null;
}

export function parseClientPreferences(body: unknown): ClientPreferencesInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const source = body as Record<string, unknown>;
  const uiLocale = parseUiLocale(source.locale);
  const tts = parseTtsPreferences(source.ttsPreferences);

  if (!uiLocale && !tts) {
    return null;
  }

  return { uiLocale, tts: tts ?? undefined };
}

export function mergeClientMetadataUpdate(
  prefs: ClientPreferencesInput | null
): Partial<ConversationSessionMetadata> | null {
  if (!prefs) {
    return null;
  }

  const update: Partial<ConversationSessionMetadata> = {};
  if (prefs.uiLocale) {
    update.uiLocale = prefs.uiLocale;
    update.ttsLang = prefs.uiLocale === 'en' ? 'en-US' : 'ru-RU';
  }

  if (prefs.tts?.lang) {
    update.ttsLang = prefs.tts.lang;
    update.uiLocale = prefs.tts.lang === 'en-US' ? 'en' : 'ru';
  }
  if (prefs.tts?.voice) {
    update.ttsVoice = prefs.tts.voice;
  }

  return Object.keys(update).length ? update : null;
}

export function mergeTtsMetadataUpdate(
  prefs: TtsPreferencesInput | null
): Partial<ConversationSessionMetadata> | null {
  if (!prefs) {
    return null;
  }

  return mergeClientMetadataUpdate({ tts: prefs });
}

export function resolveTtsSynthesisOptions(
  session: ConversationSession | null | undefined,
  requestPrefs?: TtsPreferencesInput | null
): { lang: string; voice?: string } {
  const lang = requestPrefs?.lang ?? session?.metadata?.ttsLang ?? 'ru-RU';
  const voice = requestPrefs?.voice ?? session?.metadata?.ttsVoice;

  return voice ? { lang, voice } : { lang };
}
