# MVP0 Resume Extraction Runbook

Этот runbook описывает эксплуатацию и диагностику нового fallback-контура:
`pdf-parse` -> `pdfplumber (resume-parser)`.

## 1. Цель

- Увеличить качество текста резюме из сложных PDF.
- Снизить долю ручного ввода после загрузки резюме.
- Держать latency extraction в предсказуемом диапазоне.

## 2. Компоненты

- `user-profile`:
  - базовый extraction: `pdf-parse`
  - fallback extraction: HTTP вызов `resume-parser`
- `resume-parser`:
  - endpoint `/extract-text`
  - внутри: `pdfplumber`

## 3. Конфигурация

Переменные для `user-profile`:

- `RESUME_PDFPLUMBER_ENABLED=true|false`
- `RESUME_PARSER_URL=http://resume-parser:3011`
- `RESUME_PARSER_TIMEOUT_MS=2500`
- `RESUME_QUALITY_THRESHOLD=0.55`

Переменная для compose:

- `RESUME_PARSER_PORT=3011` (опционально)

## 4. Быстрые проверки

### 4.1 Проверка здоровья сервиса

```bash
curl -sS http://localhost:3011/health
```

Ожидаемо: `{"status":"ok"}`

### 4.2 Smoke на одном PDF

```bash
npm run smoke:resume -- "/path/to/file.pdf"
```

Результат покажет:
- chars/quality/ms для `pdf-parse`
- chars/quality/ms для `pdfplumber`
- `Suggested extractor`

### 4.3 Batch smoke на папке PDF

```bash
npm run smoke:resume:batch -- "/path/to/folder-with-pdf"
```

Результат покажет:
- сколько файлов обработано
- сколько раз выиграл `pdfplumber` vs `pdf-parse`
- средние `quality/chars/ms`

## 5. Операционная логика fallback

`user-profile` использует `pdfplumber`, если:
- включен флаг `RESUME_PDFPLUMBER_ENABLED=true`
- результат `pdf-parse` ниже качества (`quality < RESUME_QUALITY_THRESHOLD`) или слишком короткий

Если `resume-parser` недоступен/ошибся:
- система возвращается к результату `pdf-parse`
- при слишком коротком тексте отдается user-facing ошибка

## 6. Что смотреть в логах

Ключевые сигналы:

- `resume extraction method=pdf-parse|pdfplumber length=...`
- `resume-parser fallback failed ...`

Алертинг/реакция:

- рост `fallback failed`:
  - проверить `resume-parser` health
  - проверить сетевую доступность `RESUME_PARSER_URL`
  - временно увеличить `RESUME_PARSER_TIMEOUT_MS`
- резкое падение качества extraction:
  - прогнать `smoke:resume:batch` на контрольной выборке
  - скорректировать `RESUME_QUALITY_THRESHOLD`

## 7. Known limitations

- `pdfplumber` не делает OCR.
- Для сканов без text layer нужен отдельный OCR fallback (следующий этап).

## 8. Rollback / disable

Самый быстрый rollback без деплоя кода:

- выставить `RESUME_PDFPLUMBER_ENABLED=false`
- перезапустить `user-profile`

После этого контур работает только на `pdf-parse`.
