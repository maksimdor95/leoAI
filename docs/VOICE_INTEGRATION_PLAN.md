## Статус реализации (MVP) ✅

На текущий момент реализована базовая функциональность голоса через **Web Speech API**:

1. **Speech-to-Text (STT)**: Пользователь может нажать на иконку микрофона и надиктовать ответ.
2. **Text-to-Speech (TTS)**: Все вопросы LEO озвучиваются браузером (русский голос).
3. **Управление**: Звук отключается кнопками Mute и Pause в интерфейсе.

Это бесплатное решение, которое позволило запустить голосовой интерфейс без внешних API ключей и затрат. План ниже (с использованием Yandex SpeechKit) остается актуальным для следующей итерации (Premium Voice).

---

# План интеграции голоса Jack (Yandex SpeechKit) - Next Step

## Обзор

Интеграция Yandex SpeechKit для синтеза речи (Text-to-Speech) для озвучивания ответов Jack.

## Архитектура решения

```
AI/NLP Service
    ↓
Генерация текста ответа (YandexGPT)
    ↓
Синтез речи (Yandex SpeechKit)
    ↓
Сохранение аудио (временный файл или URL)
    ↓
Conversation Service
    ↓
Передача audioUrl в метаданных сообщения
    ↓
Frontend
    ↓
Воспроизведение аудио
```

## Этапы реализации

### Этап 1: Настройка Yandex SpeechKit

**Длительность**: 30-60 минут

**Задачи**:

1. Получить API ключ для Yandex SpeechKit
2. Выбрать голос для Jack (рекомендуется: `jane` или `omazh` для нейтрального тона)
3. Настроить переменные окружения:
   - `YC_SPEECHKIT_API_KEY` - API ключ для SpeechKit
   - `YC_SPEECHKIT_FOLDER_ID` - Folder ID (если нужен)
   - `YC_SPEECHKIT_VOICE` - ID голоса (по умолчанию: `jane`)

**Документация**:

- [Yandex SpeechKit TTS API](https://cloud.yandex.ru/docs/speechkit/tts/)

---

### Этап 2: Создание клиента SpeechKit в AI/NLP Service

**Длительность**: 1-2 часа

**Файлы**:

- `services/ai-nlp/src/services/speechKitClient.ts` (новый)

**Задачи**:

1. Создать функцию `synthesizeSpeech(text: string, options?: SpeechOptions): Promise<Buffer>`
2. Использовать Yandex SpeechKit REST API:
   - Endpoint: `https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize`
   - Method: POST
   - Headers: `Authorization: Api-Key <API_KEY>`
   - Body: `text`, `lang`, `voice`, `format`, `speed`, `emotion`
3. Возвращать аудио в формате OGG Opus (рекомендуется для веба)
4. Обработка ошибок с fallback

**Пример кода**:

```typescript
import axios from 'axios';
import { logger } from '../utils/logger';

const SPEECHKIT_URL = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize';
const API_KEY = process.env.YC_SPEECHKIT_API_KEY;
const VOICE = process.env.YC_SPEECHKIT_VOICE || 'jane';

export interface SpeechOptions {
  voice?: string;
  emotion?: 'neutral' | 'good' | 'evil';
  speed?: string; // '0.1' to '3.0'
  format?: 'lpcm' | 'oggopus' | 'mp3';
}

export async function synthesizeSpeech(text: string, options: SpeechOptions = {}): Promise<Buffer> {
  if (!API_KEY) {
    throw new Error('YC_SPEECHKIT_API_KEY is not set');
  }

  try {
    const response = await axios.post(
      SPEECHKIT_URL,
      {
        text,
        lang: 'ru-RU',
        voice: options.voice || VOICE,
        emotion: options.emotion || 'neutral',
        speed: options.speed || '1.0',
        format: options.format || 'oggopus',
      },
      {
        headers: {
          Authorization: `Api-Key ${API_KEY}`,
        },
        responseType: 'arraybuffer',
        timeout: 10000,
      }
    );

    return Buffer.from(response.data);
  } catch (error) {
    logger.error('Failed to synthesize speech:', error);
    throw error;
  }
}
```

---

### Этап 3: Интеграция в генерацию ответов

**Длительность**: 1-2 часа

**Файлы**:

- `services/ai-nlp/src/controllers/generationController.ts` (обновить)
- `services/ai-nlp/src/services/speechKitClient.ts` (использовать)

**Задачи**:

1. После генерации текста вопроса вызывать `synthesizeSpeech()`
2. Сохранять аудио во временное хранилище:
   - Вариант A: Локальный файл (для разработки)
   - Вариант B: Облачное хранилище (S3, Yandex Object Storage)
   - Вариант C: Возвращать base64 в ответе (для небольших текстов)
3. Добавить `audioUrl` в ответ генерации

**Пример изменения**:

```typescript
// В generateStepMessage после генерации текста
const audioBuffer = await synthesizeSpeech(generatedText);
// Сохранить аудио и получить URL
const audioUrl = await saveAudio(audioBuffer, sessionId, stepId);
// Добавить в ответ
response.message.audioUrl = audioUrl;
```

---

### Этап 4: Обновление типов сообщений

**Длительность**: 15-30 минут

**Файлы**:

- `services/conversation/src/types/message.ts` (обновить)

**Задачи**:

1. Добавить `audioUrl?: string` в `MessagePayload.metadata`
2. Убедиться, что `MessagePayload` уже поддерживает метаданные

**Текущая структура** (уже есть):

```typescript
export interface MessagePayload {
  message: Message;
  metadata?: {
    isTyping?: boolean;
    audioUrl?: string; // Уже есть!
  };
}
```

---

### Этап 5: Обновление Conversation Service

**Длительность**: 30-60 минут

**Файлы**:

- `services/conversation/src/services/dialogueEngine.ts` (обновить)
- `services/conversation/src/services/aiClient.ts` (обновить)

**Задачи**:

1. Обновить `generateStepQuestionText` для получения `audioUrl`
2. Передавать `audioUrl` в метаданных сообщения
3. Обработка ошибок (если аудио не сгенерировалось, продолжать без него)

**Пример**:

```typescript
const result = await generateStepQuestionText(...);
const message = await buildQuestionMessage(...);
if (result.audioUrl) {
  // audioUrl уже в metadata через aiClient
}
```

---

### Этап 6: Обновление Frontend

**Длительность**: 2-3 часа

**Файлы**:

- `frontend/app/chat/page.tsx` (обновить)
- `frontend/components/ChatMessage.tsx` (обновить или создать)

**Задачи**:

1. Добавить компонент для воспроизведения аудио
2. Добавить кнопки Play/Pause/Mute
3. Обработать загрузку аудио
4. Показывать индикатор загрузки аудио
5. Обработать ошибки воспроизведения

**Пример компонента**:

```typescript
'use client';

import { useState, useRef } from 'react';
import { PlayCircleOutlined, PauseCircleOutlined, SoundOutlined } from '@ant-design/icons';

interface AudioPlayerProps {
  audioUrl: string;
}

export function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="audio-player">
      <button onClick={handlePlay} disabled={isLoading}>
        {isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
      </button>
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
```

---

### Этап 7: Оптимизация и кеширование

**Длительность**: 1-2 часа

**Задачи**:

1. Реализовать кеширование аудио (по тексту или hash)
2. Не генерировать аудио для одинаковых текстов
3. Очистка старых аудиофайлов (cron job или при завершении сессии)
4. Оптимизация размера аудио (формат, битрейт)

**Варианты кеширования**:

- Redis (для временного хранения)
- Локальная файловая система (для разработки)
- Облачное хранилище (для production)

---

## Порядок выполнения

1. ✅ Этап 1: Настройка Yandex SpeechKit
2. ✅ Этап 2: Создание клиента SpeechKit
3. ✅ Этап 3: Интеграция в генерацию ответов
4. ✅ Этап 4: Обновление типов сообщений
5. ✅ Этап 5: Обновление Conversation Service
6. ✅ Этап 6: Обновление Frontend
7. ✅ Этап 7: Оптимизация и кеширование

---

## Переменные окружения

Добавить в `.env` файлы:

**AI/NLP Service**:

```env
YC_SPEECHKIT_API_KEY=your_api_key_here
YC_SPEECHKIT_VOICE=jane
YC_SPEECHKIT_FOLDER_ID=your_folder_id (опционально)
```

---

## Тестирование

### Тест 1: Генерация аудио

1. Запустить AI/NLP Service
2. Вызвать эндпоинт генерации вопроса
3. Проверить, что `audioUrl` присутствует в ответе
4. Проверить, что аудио доступно по URL

### Тест 2: Воспроизведение на фронте

1. Открыть чат
2. Дождаться вопроса от Jack
3. Проверить, что кнопка Play отображается
4. Нажать Play и проверить воспроизведение

### Тест 3: Обработка ошибок

1. Отключить SpeechKit API
2. Проверить, что диалог продолжается без аудио
3. Проверить, что нет критических ошибок

---

## Известные ограничения

1. **Размер текста**: SpeechKit имеет лимит на длину текста (обычно 5000 символов)
2. **Стоимость**: Каждый запрос синтеза речи стоит денег
3. **Латентность**: Генерация аудио добавляет задержку к ответу
4. **Хранение**: Нужно решить, где хранить аудиофайлы

---

## Рекомендации

1. **Начать с простого**: Сначала реализовать базовую версию без кеширования
2. **Опциональность**: Сделать голос опциональным (можно отключить через env)
3. **Fallback**: Всегда продолжать работу, даже если аудио не сгенерировалось
4. **Мониторинг**: Добавить метрики для отслеживания использования SpeechKit

---

## Следующие шаги после интеграции

1. Добавить настройку голоса в профиле пользователя
2. Добавить выбор эмоции голоса
3. Добавить скорость речи
4. Добавить поддержку других языков
