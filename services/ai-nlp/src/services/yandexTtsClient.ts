import axios from 'axios';
import { logger } from '../utils/logger';

const TTS_URL = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize';

type TtsFormat = 'mp3' | 'oggopus';

export type TtsAudioResult = {
  audioBase64: string;
  mimeType: string;
  format: TtsFormat;
};

export async function synthesizeWithYandexTts(params: {
  text: string;
  lang?: string;
  voice?: string;
  speed?: number;
  format?: TtsFormat;
}): Promise<TtsAudioResult> {
  const apiKey = process.env.YC_API_KEY;
  if (!apiKey) {
    throw new Error('YC_API_KEY is missing; cannot call Yandex TTS');
  }

  const format: TtsFormat = params.format ?? 'mp3';
  const body = new URLSearchParams({
    text: params.text,
    lang: params.lang ?? 'ru-RU',
    voice: params.voice ?? 'filipp',
    speed: String(params.speed ?? 1.15),
    format,
  });

  const response = await axios.post<ArrayBuffer>(TTS_URL, body.toString(), {
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 20000,
  });

  const data = Buffer.from(response.data);
  if (!data.length) {
    throw new Error('Yandex TTS returned empty audio payload');
  }

  logger.info(`TTS synthesized (${format}), bytes=${data.length}`);

  return {
    audioBase64: data.toString('base64'),
    mimeType: format === 'mp3' ? 'audio/mpeg' : 'audio/ogg; codecs=opus',
    format,
  };
}
