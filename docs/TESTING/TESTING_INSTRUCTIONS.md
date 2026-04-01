# Инструкции по запуску тестов

## Установка зависимостей

Перед запуском тестов необходимо установить зависимости для тестирования.

### Conversation Service

```powershell
cd C:\Users\Marina\Desktop\AIheroes\services\conversation
npm install
```

Это установит Jest и необходимые зависимости для тестирования.

### AI/NLP Service

```powershell
cd C:\Users\Marina\Desktop\AIheroes\services\ai-nlp
npm install
```

## Запуск тестов

### Conversation Service

```powershell
cd C:\Users\Marina\Desktop\AIheroes\services\conversation
npm test
```

Для запуска в режиме watch (автоматический перезапуск при изменениях):

```powershell
npm run test:watch
```

Для генерации отчета о покрытии кода:

```powershell
npm run test:coverage
```

### AI/NLP Service

```powershell
cd C:\Users\Marina\Desktop\AIheroes\services\ai-nlp
npm test
```

Для запуска в режиме watch:

```powershell
npm run test:watch
```

Для генерации отчета о покрытии кода:

```powershell
npm run test:coverage
```

## Структура тестов

### Conversation Service

Тесты находятся в `services/conversation/src/services/__tests__/`:

- `dialogueEngine.test.ts` - тесты для логики обработки диалога
  - `evaluateCondition` - оценка условий переходов
  - `resolveNextStep` - определение следующего шага

### AI/NLP Service

Тесты находятся в `services/ai-nlp/src/controllers/__tests__/`:

- `validationController.test.ts` - тесты для валидации ответов
  - Предварительная валидация (пустые ответы, только знаки препинания)
  - Валидация числовых ответов для вопросов об опыте
  - Валидация коротких ответов для отраслей
  - Валидация названий должностей
  - Обработка ошибок

- `profileController.test.ts` - тесты для анализа профиля
  - Полный профиль
  - Неполный профиль с критичными пробелами
  - Обработка ошибок

- `contextController.test.ts` - тесты для проверки контекста
  - Ответы в теме
  - Ответы не по теме
  - Извлечение важной информации
  - Обработка ошибок

## Что тестируется

### Базовые функции

- ✅ Оценка условий переходов (числовые сравнения, текстовые сравнения)
- ✅ Определение следующего шага на основе условий
- ✅ Валидация ответов (пустые, нерелевантные, неясные)
- ✅ Анализ полноты профиля
- ✅ Проверка контекста диалога

### Edge cases

- ✅ Обработка ошибок API (YandexGPT недоступен)
- ✅ Некорректные JSON ответы от AI
- ✅ Валидные короткие ответы (числа, короткие названия)
- ✅ Различные варианты команд

## Интерпретация результатов

### Успешный запуск

```
PASS  src/services/__tests__/dialogueEngine.test.ts
  dialogueEngine
    evaluateCondition
      ✓ should evaluate numeric less than condition (2 ms)
      ✓ should evaluate numeric greater than condition (1 ms)
      ...
    resolveNextStep
      ✓ should return default step when no conditions (1 ms)
      ...

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

### Ошибки

Если тесты падают, проверьте:

1. **Установлены ли зависимости:**

   ```powershell
   npm install
   ```

2. **Правильно ли настроены моки:**
   - Моки для `yandexClient` должны быть настроены перед импортом контроллеров
   - Моки для `logger` должны быть настроены

3. **Соответствуют ли типы:**
   - Проверьте, что типы в тестах соответствуют реальным типам в коде

## Добавление новых тестов

### Для Conversation Service

1. Создайте файл `services/conversation/src/services/__tests__/yourFunction.test.ts`
2. Импортируйте функцию для тестирования
3. Настройте моки для зависимостей
4. Напишите тесты используя Jest API

Пример:

```typescript
import { yourFunction } from '../yourFile';

describe('yourFunction', () => {
  it('should do something', () => {
    const result = yourFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Для AI/NLP Service

1. Создайте файл `services/ai-nlp/src/controllers/__tests__/yourController.test.ts`
2. Настройте моки для `yandexClient` и `logger`
3. Создайте mock Request и Response объекты
4. Напишите тесты

Пример:

```typescript
import { yourController } from '../yourController';
import { callYandexModel } from '../../services/yandexClient';

jest.mock('../../services/yandexClient', () => ({
  callYandexModel: jest.fn(),
}));

describe('yourController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Setup mocks
  });

  it('should handle request', async () => {
    // Test implementation
  });
});
```

## Покрытие кода

Для просмотра отчета о покрытии кода:

```powershell
npm run test:coverage
```

Отчет будет создан в папке `coverage/`. Откройте `coverage/lcov-report/index.html` в браузере для просмотра детального отчета.

## Известные ограничения

1. **Тесты не требуют запущенных сервисов** - все внешние зависимости замокированы
2. **Тесты не требуют Redis или PostgreSQL** - используются моки
3. **Тесты не требуют YandexGPT API ключей** - API вызовы замокированы

## Следующие шаги

После успешного запуска тестов:

1. Добавьте больше тестов для edge cases
2. Увеличьте покрытие кода до 80%+
3. Настройте CI/CD для автоматического запуска тестов
4. Добавьте интеграционные тесты (требуют запущенных сервисов)
