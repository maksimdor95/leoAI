import axios from 'axios';
import { logger } from '../utils/logger';

const TTS_URL = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize';

type TtsFormat = 'mp3' | 'oggopus';

/** Синхронно с services/conversation/src/services/aiClient.ts (TTS_PRESETS) — preset задаёт голос/скорость/формат API. */
const TTS_PRESETS: Record<string, { voice: string; speed: number; format: TtsFormat }> = {
  ermil_normal: { voice: 'ermil', speed: 1.0, format: 'oggopus' },
  ermil_soft: { voice: 'ermil', speed: 0.92, format: 'oggopus' },
  filipp_fast: { voice: 'filipp', speed: 1.08, format: 'oggopus' },
};

export type TtsAudioResult = {
  audioBase64: string;
  mimeType: string;
  format: TtsFormat;
};

export async function synthesizeWithYandexTts(params: {
  text: string;
  lang?: string;
  voice?: string;
  preset?: string;
  speed?: number;
  format?: TtsFormat;
}): Promise<TtsAudioResult> {
  const apiKey = process.env.YC_API_KEY;
  const folderId = process.env.YC_FOLDER_ID;
  if (!apiKey) {
    throw new Error('YC_API_KEY is missing; cannot call Yandex TTS');
  }

  const fromPreset = params.preset ? TTS_PRESETS[params.preset] : undefined;
  const voice = params.voice ?? fromPreset?.voice ?? process.env.TTS_VOICE ?? 'ermil';
  const envSpeed = Number(process.env.TTS_SPEED);
  const speed =
    params.speed ??
    fromPreset?.speed ??
    (Number.isFinite(envSpeed) && envSpeed > 0 ? envSpeed : 1.0);
  const format: TtsFormat = params.format ?? fromPreset?.format ?? 'oggopus';

  const body = new URLSearchParams({
    text: params.text,
    lang: params.lang ?? 'ru-RU',
    voice,
    speed: String(Number.isFinite(speed) && speed > 0 ? speed : 1.0),
    format,
    ...(folderId ? { folderId } : {}),
  });

  const response = await axios.post<ArrayBuffer>(TTS_URL, body.toString(), {
    responseType: 'arraybuffer',
    // Ignore system HTTP(S)_PROXY for Yandex API calls in local dev.
    proxy: false,
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(folderId ? { 'x-folder-id': folderId } : {}),
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
