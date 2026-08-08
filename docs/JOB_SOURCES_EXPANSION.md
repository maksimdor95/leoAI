# Расширение источников вакансий (M7 → Leo)

**Цель:** шире воронка для Jack (все role family), без ломки HH/SJ.  
**Подход:** идеи и каталоги из Kabi M7 + найденные публичные JSON API бигтехов.  
**Статус:** волны A+B в коде; локально `ENABLE_EXTENDED_JOB_SOURCES=true`.  
**Smoke (2026-07-31):** `scrapeExtendedSources` → **79 jobs**, `errors=[]`.  
**Pipeline refactor:** Phase 0 ✅ (extended-only persist); Phases 1–5 — см. §10.

---

## 1. Принципы

1. **Additive only** — HH.ru и SuperJob не меняем по смыслу; новые источники рядом.
2. **Fail-open** — падение одного коннектора не роняет scrape.
3. **Multi-role** — фильтр по keywords из `scrapeProfileParams` / `roleFamily`, не product-only.
4. **Feature-flag** — `ENABLE_EXTENDED_JOB_SOURCES=false` по умолчанию.
5. **Дедуп** — `createOrUpdate` по `source` + `source_url`; HH-записи не затираем агрессивным merge.

---

## 2. Источники

### Волна A — JSON API ✅

| ID | Source string | Endpoint | Объём (проба) | Заметки |
|----|---------------|----------|---------------|---------|
| `yandex` | `career_yandex` | `yandex.ru/jobs/api/publications` | — | Уже в Kabi |
| `mts` | `career_mts` | `job.mts.ru/api/v2/vacancies` | ~2.6k | Пагинация `pagination[page/pageSize]` |
| `wb` | `career_wb` | `career.rwb.ru/crm-api/api/v1/pub/vacancies` | ~343 | `limit/offset/title` |
| `alfa` | `career_alfa` | `job.alfabank.ru/api/vacancies?take&skip&text` | ~2.3k | Нужен `take`; SSL → `ALFA_SSL_INSECURE` |
| `sber` | `career_sber` | `…/api/v1/publications?skip&take` | ~3.6k | Client-side keyword filter |

### Волна B — HTML / TG ✅

| ID | Source | Статус | Риск |
|----|--------|--------|------|
| `habr` | `career.habr.com` | ✅ RSS + HTML fallback | ToS / вёрстка |
| `tg` | `tg_<channel>` | ✅ `t.me/s/` + каталог JSON | timeout ~8s |
| `geekjob` | `geekjob.ru` | ✅ listing HTML | ToS / вёрстка |
| `getmatch` | `getmatch.ru` | ✅ через `g_jobchannel` | TG + enrich |
| `avito` / `vk` / `tbank` | `career_*` | ✅ HTML list (T-Bank: IT SSR + `list_urls`, Kabi parity) | вёрстка |

### Волна C — backlog

| ID | Почему |
|----|--------|
| `ozon` | Antibot redirect loop (`__rr`) |
| `sber` search params | Добить query из фронта |

---

## 3. Архитектура в Leo

```
services/job-matching/src/services/
  scraper.ts                 # scrapeHHJobs + scrapeExtendedOnly + persistScrapedJobs
  connectors/
    types.ts                 # JobConnector
    config.ts                # env flags / limits
    index.ts                 # registry + scrapeExtendedSources(+afterConnector)
    mapJob.ts                # общие helpers → JobInput
    yandexConnector.ts … tbankConnector.ts
  data/
    tg_job_channels.json
    career_sites.json
```

Поток (Phase 1 orchestrator):

```
scrapeCatalog / scrapeHHJobs(keywords)
  → Promise.allSettled([
       HH family → persist(+enrich),
       SJ family → persist(+enrich),
       Extended → per-connector persist (enrich off),
     ])  // per-family timeout via SCRAPE_*_TIMEOUT_MS

scrapeExtendedOnly(keywords)   # Phase 0 — families=['extended']
  → same orchestrator, allowMockFallback=false
```

---

## 4. Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `ENABLE_EXTENDED_JOB_SOURCES` | `false` | Master switch |
| `EXTENDED_JOB_SOURCES` | `all` (= wave A+B) | CSV или `all` |
| `EXTENDED_JOB_KEYWORD_LIMIT` | `5` | Keywords per connector |
| `EXTENDED_JOB_MAX_PER_SOURCE` | `40` | Cap per connector run |
| `ALFA_SSL_INSECURE` | `true` | verify=false для job.alfabank.ru |
| `SCRAPER_USER_AGENT` | existing | Reuse; fallback Leo UA |
| `TG_HTTP_PROXY` | — | SOCKS5/HTTP for `t.me/s/` (TG + Getmatch). Kabi parity. Fallback: `TELEGRAM_PROXY_URL` / `HTTPS_PROXY` |

### Поэтапный rollout

1. **Локально / staging:** `ENABLE_EXTENDED_JOB_SOURCES=true`, `EXTENDED_JOB_SOURCES=all`
2. При шуме — сузить CSV: сначала `yandex,mts,wb`, потом `+alfa,sber`, потом `+habr,tg,getmatch`, потом HTML
3. Production: включать после проверки `sourcesUsed` / matching quality
4. Ozon — только после antibot-решения

---

## 5. Маппинг → JobInput

| Поле | Правило |
|------|---------|
| `source` | стабильный id (`career_mts`, …) |
| `source_url` | публичная карточка (не listing) |
| `company` | org / фиксированное имя |
| `location` | `string[]` |
| `work_mode` | remote/office/hybrid из полей источника |
| `role_family` | `classifyRoleFamily(title)` |
| `skills` | `[]` если нет (enrich позже) |
| `source_meta` | `null` (HH-only) |

UI / apply: `resolvePublicVacancyUrl` уже принимает любой https URL.  
Refresh карточки / HH OAuth — только `source === 'hh.ru'` (не трогаем).

---

6. Порядок внедрения

1. ✅ Волна A (JSON API) + feature-flag  
2. ✅ Волна B (Habr / TG / Getmatch / Avito / VK / T-Bank)  
3. ✅ Env local/staging: `ENABLE_EXTENDED_JOB_SOURCES=true`, `EXTENDED_JOB_SOURCES=all`  
4. ⚠️ Smoke коннекторов (см. §9) — OK; полный `POST /refresh` (HH+SJ+extended) — процесс job-matching падает mid-HH (разобрать отдельно)  
5. Matching quality smoke + persona — next  
6. Ozon / softer keyword match / HTML 0-results — next  

---

## 7. Не делаем

- Python sidecar / зависимость от Kabi runtime  
- Product-only `relevance_any`  
- Talks/CFP  
- Включение Ozon без решения antibot  
- Молчаливое урезание согласованных фаз pipeline refactor (§10)  

---

## 8. Метрики успеха

- `sourcesUsed` содержит extended ids при flag on  
- `jobsSaved` > 0 с non-HH/SJ  
- Jack matching по-прежнему отдаёт релевантный топ (smoke + persona)  
- При flag off — поведение идентично текущему MVP0  

---

## 9. Smoke checklist + прогон 2026-07-31

### Команды

```bash
# 1) health
curl -s http://127.0.0.1:3004/health

# 2) background scrape (JWT/catalog token если нужен)
curl -s -X POST http://127.0.0.1:3004/api/jobs/refresh

# 3) логи
rg 'Extended sources|Extended source|Sources=|MOCK' .runlogs/job-matching.log

# 4) каталог
curl -s 'http://127.0.0.1:3004/api/jobs/catalog?source=career_wb&limit=5'
```

### Результат: прямой `scrapeExtendedSources` (без HH/SJ)

| Метрика | Значение |
|---------|----------|
| Keywords | Product Manager, Backend Developer, Data Analyst |
| jobs | **79** |
| errors | **[]** |
| time | ~48s |
| sourcesUsed | career-wb-api, career-alfa-api, career-sber-api, career-habr, tg-jobs, getmatch |

| Source | jobs |
|--------|------|
| career_wb | 26 |
| career_sber | 19 |
| career.habr.com | 19 |
| tg_* | 8 |
| career_alfa | 4 |
| getmatch.ru | 3 |
| yandex / mts / avito / vk / tbank | **0** (при этих keywords) |

Fail-open: ок (нули без exceptions).

### Почему нули (гипотезы → next)

1. **yandex / mts** — `keywordMatches` ищет substring всей фразы (`Product Manager`); русские заголовки вроде «Менеджер по продукту» не матчятся. Нужен token-level / RU synonyms.  
2. **avito / vk / tbank** — HTML path_regex или пустой SSR + тот же keyword filter.  
3. **Полный `/api/jobs/refresh`** — сервис умер после `Found 100 vacancies for "Product Manager"` (до extended). Не блокер коннекторов; чинить стабильность scrape/process.

### Дальше по плану

См. **§10 Pipeline refactor** (поэтапно + smoke). Soft keyword match / Ozon — в Phase 5 / backlog.

---

## 10. Pipeline refactor (Leo vs Kabi bar)

Kabi: 20+ источников, **save после каждого коннектора**, fail-open, scrape не роняет выдачу.  
Leo цель: тот же уровень надёжности без Python sidecar.

| Phase | DoD | Статус |
|-------|-----|--------|
| **0** Extended-only ingest | `scrapeExtendedOnly` + `POST /api/jobs/scrape/extended` + persist per connector; non-HH в каталоге/матче | ✅ |
| **1** Orchestrator | HH \| SJ \| Extended `allSettled` + timeout; persist per family; HH fail ≠ блок extended | ✅ |
| **2** API ≠ scrape process | HTTP только enqueue; **default `SCRAPE_INLINE_WORKER=false`**; `dev:up` стартует `job-matching-worker` | ✅ |
| **3** Enrichment out-of-band | Enrich off on scrape; Bull `enrich-jobs` every 20m; lazy enrich after match | ✅ |
| **4** Separate crons + metrics | HH@:00 SJ@:15 Extended 2h@:30; `ScrapeReport` / `bySource` in result+logs | ✅ |
| **5** Polish | Parallel connectors, soft keywords, docs, tests | ✅ |
| **Hygiene** revalidate | Worker cron @:45: HH + SJ + Getmatch + Habr + Geekjob + career_* (wb/mts/yandex/alfa/sber). Soft-archive only on explicit 404/410/API-archived; HTML redirect-off-path → error. Registry `services/revalidate/`. Opt-in filter: `JOB_REVALIDATE_SOURCES` | ✅ Phase 0–3 (Avito/VK/T-Bank/TG → Phase 4) |

### Phase 0 / 5 smoke (2026-08-04)

```bash
cd services/job-matching && npx ts-node --transpile-only scripts/scrape-extended-only.ts \
  "Product Manager" "Менеджер продукта" "Backend Developer"
```

| Прогон | scraped/saved | sources (nonzero) |
|--------|---------------|-------------------|
| Phase 0 (phrase match) | 87/87 | wb, alfa, sber, habr |
| Phase 5 (+ soft keywords + concurrency=3) | **221/221** ~37s | **+ yandex, mts, avito, vk, tg** |

TG/getmatch: задай `TG_HTTP_PROXY` (как в Kabi, обычно `socks5://…`). Без proxy с РФ/локали часто timeout — fail-open, не роняют прогон.

### Cross-source dedup (match)

В `matchJobs` после скоринга: fingerprint `normalize(company)+normalize(title)`.  
Одна карточка; приоритет источника: **career_* / habr > geekjob/getmatch > hh.ru > superjob > tg**.  
Пример: HH «СБЕР» + `career_sber` «ПАО Сбербанк» → остаётся career.

### Паритет фидов с Kabi

| | Kabi | Leo |
|--|------|-----|
| Борды | HH, SJ, Getmatch, Habr, Geekjob | то же |
| Career | 8 | 8 |
| TG must | 23 | **23** |
| Ozon | off | off |
