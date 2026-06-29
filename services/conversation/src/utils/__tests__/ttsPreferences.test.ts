import {
  mergeClientMetadataUpdate,
  parseClientPreferences,
  parseTtsPreferences,
  resolveTtsSynthesisOptions,
} from '../ttsPreferences';
import { ConversationSession } from '../../types/session';

describe('ttsPreferences', () => {
  it('parses lang and voice from request body', () => {
    expect(parseTtsPreferences({ lang: 'en-US', voice: 'Jane' })).toEqual({
      lang: 'en-US',
      voice: 'jane',
    });
    expect(parseTtsPreferences({ voice: 'ermil' })).toEqual({ voice: 'ermil' });
    expect(parseTtsPreferences(null)).toBeNull();
  });

  it('parses locale and tts from client body', () => {
    expect(
      parseClientPreferences({
        locale: 'en',
        ttsPreferences: { lang: 'en-US', voice: 'jane' },
      })
    ).toEqual({
      uiLocale: 'en',
      tts: { lang: 'en-US', voice: 'jane' },
    });
  });

  it('merges locale into session metadata', () => {
    expect(mergeClientMetadataUpdate({ uiLocale: 'en' })).toEqual({
      uiLocale: 'en',
      ttsLang: 'en-US',
    });
  });

  it('prefers request prefs over session metadata', () => {
    const session = {
      metadata: { ttsLang: 'ru-RU', ttsVoice: 'ermil', uiLocale: 'ru' as const },
    } as ConversationSession;

    expect(resolveTtsSynthesisOptions(session, { lang: 'en-US', voice: 'jane' })).toEqual({
      lang: 'en-US',
      voice: 'jane',
    });
  });
});
