# Медицинская вертикаль: ТЗ жены → Kabi vs LEO AI

> Сводка пожеланий + продуктовый разбор.  
> Источник: переписка / ТЗ «Мой Пирожок».  
> Дата: 2026-08-23.

---

## 1. TL;DR

Жена описывает не «улучшить персонального менеджера», а **вход в вертикаль «работа медикам»**:

1. Агрегировать вакансии из каналов и досок в Telegram-бот **по профессиям**.
2. Опереться на **официальную номенклатуру должностей врачей РФ**.
3. Под каждую должность — таксономия обязанностей / навыков / квалификаций.
4. Онбординг: выбор должности → предзаполненный профиль.
5. Эффект: трафик → профили в нужном формате → **база специалистов** → (следующие ТЗ).

**Вывод по дому продукта:** flywheel «магнит → профили → база → B2B» → **LEO Med** (только LEO, без Kabi).

### Согласованные решения (2026-08-23)

| Тема | Решение |
|------|---------|
| Продукт | **LEO Med only** — не Kabi, не hybrid |
| Бренд | **LEO Med** (мульти-лендинг уже есть; бот — тот же бренд) |
| Scope v1 | **Врачи + средний + младший** + фарма / руководящие / junior extras (taxonomy) |
| Гео | **вся РФ** |
| Аудитория | Холодные соискатели-медики (жена **не** медик, не целевой тест-юзер) |
| Метрика этапа (Phase 3) | **N завершённых профилей** с consent (см. решения 2026-08-26) |
| Следующий шаг | **Phase 3 ✅** — онбординг + consent A (web) |

### Решения (2026-08-26) — scope + consent + канал

| Тема | Решение |
|------|---------|
| Consent | Черновик **сами** (+ практики 152‑ФЗ); юрист/жена — ревью, не блокер старта черновика. Черновик: `docs/med/CONSENT_DRAFT.md` |
| Формулировка «покажем клиникам позже» | **Не в одном чекбоксе** с хранением. Два согласия: (A) хранение в LEO Med; (B) отдельный opt-in на показ/передачу клиникам-работодателям — **позже / когда появится B2B**. См. draft |
| N профилей | «Чем больше — тем лучше». Операционные вехи (не потолок): **10** smoke → **50** первый сигнал GTM → **100+** уверенный Phase 3. Дальше растём без «стоп-числа» |
| Бот в Phase 3 | **Не блокер.** Phase 3 = web `/med` + API. TG-бот = **эволюция** (цель — весь LEO в бот; Med бот не обязателен в DoD Phase 3) |
| Провизор / фармацевт | **Обязательно в v1** |
| Руководящие (главный врач, главная акушерка, …) | **Обязательно в v1** |
| Сиделка, няня, санитар-водитель и т.п. | **Обязательно в LEO Med** |
| Документы / аккредитации | **Уточнять у пользователя** в онбординге (не выдумывать из пустого `qualifications[]`) |
| Связка вакансия ↔ справочник ↔ таксономия | **Закрыто:** 181/181 mapped; см. §6.1 |

---

## 2. Исходное ТЗ (нормализованное)

### ТЗ 1 — Источники и агрегация

- Собрать источники вакансий для врачей / среднего / младшего медперсонала.
- Дополнить список через поиск «где искать работу врачом» (то, чего нет в списке — добавить).
- Агрегировать всё в **Telegram-бот**, навигация **по профессиям**.

### ТЗ 2 — Номенклатура должностей

- Базовый справочник врачей: официальный перечень в РФ  
  (ссылка из ТЗ: `http://publication.pravo.gov.ru/document/0001202605300020?index=2`).
- **Решение v1:** также средний + младший — отдельные справочники / ветки.
- Вакансии маппить / фильтровать под эти должности.

### ТЗ 3 — Таксономия компетенций

- Под каждую должность: обязанности, навыки, квалификации.
- Если нет открытых источников — черновик через LLM (с пометкой происхождения).

### ТЗ 4 — Профили

- UX: уровень (врач / средний / младший) → «кем вы являетесь / хотите быть» → dropdown.
- Под выбор подставляется предзаполненная таксономия; пользователь правит галочками.

### Желаемый эффект (её формулировка)

| Шаг | Результат |
|-----|-----------|
| Агрегатор | Ценность «все вакансии в одном месте» |
| Трафик | Привлечение аудитории |
| Онбординг | Профили в структурированном формате |
| Актив | База специалистов |
| Дальше | «Расскажу в следующих ТЗ» (рекрутинг / B2B) |

---

## 3. Каталог источников из переписки

### 3.1. Telegram-каналы / группы

| Канал / группа | URL | Заметки |
|----------------|-----|---------|
| SuperJob медицина | https://t.me/superjob_medicina | Контакт: @superjob_telegram |
| Работа медики (Москва) | https://t.me/rabota_mediki | @nslepova |
| Работа медсестра | https://t.me/rabota_medsestra | @nslepova |
| Работать в медицине | https://t.me/Rabotat_v_meditsina1 | Размещение: @Jober_Supporting |
| Med Job 4 you | https://t.me/Med_Job_4_you | @VictoriaKVI, РФ |
| ЦСО / рентген / младший персонал | https://t.me/csorglaborantmladpersonal | Узкая ниша |
| job_in_med / job_in_zdrav | https://t.me/job_in_med · https://t.me/job_in_zdrav | @uninstall99 |
| HH vacancy medicine | https://t.me/hh_vacancy_medicine | Реклама: site_adv@hh.ru |
| Med vacancy (удалёнка) | https://t.me/med_vacancy | Remote |
| Rehabilitation vacancies | https://t.me/rehabilitation_vacancies | Узкая ниша (зависимости) |
| Medsmena | https://t.me/medsmena | — |

**Риски TG-ingest:** дубли, протухшие посты, реклама размещения, нет API, юридическая серость скрапинга, высокая стоимость поддержки.

### 3.2. Job boards (явно названы)

- HH.ru  
- Rabota.ru  
- Зарплата.ру  
- Авито Работа  
- (логично рядом) SuperJob — уже есть в экосистеме Kabi/LEO  

**Рекомендация:** доски = основа качества; каналы = доп. покрытие «свежака» и узких ролей, не единственный столп.

### 3.3. Discovery (её процесс)

> В поисковике: «где искать работу врачом» → источники, которых нет в списке, добавить.

Имеет смысл вести **реестр источников**: приоритет, тип (API / HTML / TG), легальность, частота, покрытие ролей/регионов.

---

## 4. Продуктовая модель (слои)

```
Источники (доски + каналы)
        ↓
Нормализованные вакансии + дедуп
        ↓
Классификация по номенклатуре должностей
        ↓
Лента / дайджест в Telegram по профессии
        ↓
Онбординг: должность → таксономия → профиль
        ↓
База специалистов  →  (следующие ТЗ: работодатели / интро / fee)
```

### Сильные стороны ТЗ

- Официальная номенклатура = якорь UX и матчинга.
- Профиль через dropdown + чеклист = данные сразу в формате для поиска.
- Честный flywheel: сначала ценность юзеру, потом актив.

### Ловушки

1. **«Все вакансии»** недостижимы — продавать «релевантные из N проверенных источников».
2. **Врачи ≠ весь медперсонал** — в акте из ТЗ в основном врачи; для среднего/младшего нужен **второй справочник** (или расширенный). Онбординг: уровень → должность.
3. **LLM-таксономия** — только как `llm_draft`, не как «требования Минздрава».
4. **База специалистов** требует явного consent и политики данных.

---

## 5. Kabi vs LEO AI

### Kabi (сейчас)

- Персональный AI-менеджер карьеры в Telegram (single-user MVP → multi-user isolation).
- Core loop: знать → искать → мэтчить → приносить → учиться.
- Метрика: «подборка реально про меня».
- Сильный UX для **личного** поиска жены; слабее как массовый мед-хаб / talent pool.

### LEO AI (сейчас)

- Платформа карьеры: Jack (вакансии), WannaNew / Interview Prep; стенд leo-ai.ru.
- Явный актив: **Career Graph** (Users — Skills — Tools — Jobs — Learning).
- Стратегия: воронка → профили → matching → **Talent Marketplace / LeoWork (B2B)**.
- Уже есть: профили, job-matching, HH/SJ, extended sources **включая TG-каналы**.
- Аудитория сейчас: IT / менеджмент; UX — **web-first** (TG — саппорт).

### Стыковка с ТЗ жены

| Критерий | Kabi | LEO | ТЗ жены |
|----------|------|-----|---------|
| Ценность | менеджер «про меня» | карьера + данные → marketplace | всё в одном + база |
| Аудитория | 1 → few | массовый B2C → B2B | массовые медики |
| UX | Telegram + Mini App | Web-чат | Telegram-бот |
| Источники | растут из MVP | HH/SJ + TG + career sites | каналы + доски |
| Профиль | CV + диалог | skills / scenarios | должность → таксономия |
| «Что дальше» | проактивность | LeoWork / marketplace | база → найм |

**Вердикт (принят):** дом продукта — **LEO Med**. Kabi в этот трек не входит.

---

## 6. План: LEO Med

### Phase 0 (foundation) — ✅ done 2026-08-24

| DoD | Статус | Где |
|-----|--------|-----|
| Реестр источников (доски + TG) | met | `services/job-matching/src/services/data/med/med_sources.json` |
| Справочники doctor / mid / junior (434н) | met | `…/data/med/med_roles.json` (196 ролей) |
| Flag `ENABLE_MED_VERTICAL` (default off) | met | `services/job-matching/src/services/med/` |
| Бренд LEO Med на мульти-лендинге | met | уже в `HeroBrandRotator` (`Med` в ротации); TG-бот — Phase 1 |

API: `isMedVerticalEnabled()`, `listMedRoles(level?)`, `listMedSources()`, `listPlannedTgChannels()`.  
Ingest / бот / профили — **не** в Phase 0.

**DoD checker (после каждой фазы / перед стартом следующей):** skill  
`.cursor/skills/leo-med-phase-dod/` — modes `verify` | `ready`.  
Скрипт: `node .cursor/skills/leo-med-phase-dod/scripts/check-phase0.cjs`

### Phase 1 (ingest + лента) — ✅ done 2026-08-24

| DoD | Статус | Где |
|-----|--------|-----|
| HH + SuperJob medicine-фильтр → каталог / med-tag | met | `scrapeMedCatalog` + `POST /api/jobs/scrape/med` |
| Маппинг vacancy → `med_role_id` (aliases + fallback) + тесты | met | `med/mapRole.ts`, `medPhase1.test.ts` |
| Врачи e2e, затем mid+junior в том же/следом релизе | met | keywords doctor-first → mid → junior; feed filter `level` |
| Потребитель: лента по профессии (+ город) | met | `GET /api/jobs/med/feed` + match в чате |
| Дедуп как в job-matching | met | `source_url` upsert + Jack match excludes `med_role_id` |
| TG: **весь** реестр жены (12 каналов) | met | все `status=active` в `med_sources.json`; `tgIngest` |
| HTML-доски реестра (Работа/Зарплата/Авито/Трудвсем/EMED) | met | `boardIngest.ts` (fail-open; Jack HTML parser + trudvsem open data) |
| `ENABLE_MED_VERTICAL` гейтит Med; Jack при `false` без изменений | met | 503 на med API; scrape no-op; Jack SQL `med_role_id IS NULL` |

### Phase 2 — таксономия (схема согласована 2026-08-26)

**Источник эксперта (жена) + файл:** `docs/med/taxonomy_meditsina_rf.md`  
(181 профессия; навыки / задачи / обязанности; ESCO + профстандарты Минтруда + номенклатуры.)

#### Решения эксперта (Q&A)

| # | Решение |
|---|---------|
| 1 | Профиль по должности = **обязанности + навыки + квалификации** — ок |
| 2 | Каталог профессий и таксономия — **приоритет официальные документы** (Минздрав / Минтруд и т.п., в т.ч. зарубежные → перевод на RU). Дыры — **парсинг вакансий**. LLM только как gap-fill с provenance |
| 3 | Покрытие Phase 2: **все врачи + медсёстры** (не top-N). Младший — та же схема |
| 4 | Навыки **могут пересекаться** между профессиями (общий пул кодов ок) |
| 5 | Поля профиля (Phase 3): должность, навыки, обязанности, опыт, документы/аккредитации, город, тип занятости (постоянная / совмещение / подработка…) |
| 6 | Средний и младший — **та же схема** |

#### Контракт данных (Phase 2 DoD)

```text
MedTaxonomyItem {
  id: string              // стабильный код (T01, V01, …) или slug
  label: string           // RU
  kind: 'skill' | 'duty' | 'qualification' | 'task'  // task из файла; в UX duties≈tasks/обязанности
  core?: boolean          // [ядро] из файла
}

MedRoleTaxonomy {
  med_role_id: string     // связь с med_roles.json (маппинг по title/aliases)
  skills: MedTaxonomyItem[]
  duties: MedTaxonomyItem[]           // обязанности (+ задачи из файла как duties или отдельно tasks)
  qualifications: MedTaxonomyItem[]   // образование / допуски / аккредитации (дополнить, если нет в файле)
  provenance: 'official' | 'open_source' | 'vacancy_parse' | 'llm_draft'
  source_refs?: string[]              // приказы, ESCO, URL
}
```

- Навыки пересекаются → общий словарь кодов + ссылки с ролей.
- Provenance обязателен; UI: «не равно требованиям Минздрава», если `llm_draft` / агрегат.
- Импорт: разобрать `docs/med/taxonomy_meditsina_rf.md` → JSON/DB; сматчить с `med_roles.json`.
- Gaps по квалификациям / ролям без файла → official first, иначе vacancy_parse, иначе llm_draft.

#### Phase 2 DoD (чеклист) — ✅ done 2026-08-26

| DoD | Статус | Где |
|-----|--------|-----|
| Схема `MedRoleTaxonomy` в коде + тесты | met | `med/types.ts`, `medTaxonomy.test.ts` |
| Импорт/лоадер из `taxonomy_meditsina_rf.md` | met | `med/scripts/generateMedTaxonomy.cjs` → `data/med/med_taxonomy.json` |
| Маппинг профессий файла → `med_role_id` | met | generator + `getTaxonomyByMedRoleId` / `BySourceTitle` |
| Provenance на уровне роли/набора | met | `provenance: official` + disclaimer |
| Покрытие: врачи + медсёстры; junior — та же схема | met | 181 профессий; levels doctor/mid/junior |
| Disclaimer в docs/API | met | catalog.disclaimer; `GET /api/jobs/med/taxonomy` |

API: `GET /api/jobs/med/taxonomy?role_id=` \| `?title=` \| `?level=doctor\|mid\|junior`  
Regen: `cd services/job-matching && npm run med:generate-taxonomy`

### Phase 3 (онбординг + consent A) — ✅ done 2026-08-26

| DoD | Статус | Где |
|-----|--------|-----|
| Onboarding: уровень → должность из каталога | met | ветка `med_*` в чате; роль из `mapRole` по ответу кандидата |
| Prefill taxonomy checklist; юзер правит | met | `resolveMedTaxonomyForRole` → шаг `med_skills` (подтвердить / убрать / добавить) |
| Поля: роль, skills, duties, опыт, документы, город, занятость, **consent A** | met | шаги `med_*` + `POST /api/jobs/med/profiles` |
| Persist `med_specialists` + consent flag | met | `MED_SPECIALISTS_MIGRATION_SQL`, `med/specialists.ts` |
| Metric N instrumented | met | `GET /api/jobs/med/profiles/stats` → `completed_with_consent_a` |
| No LeoWork / sale without consent B | met | consent B optional; текст согласия говорит «позже»; не в метрике N |
| Канал web (бот не DoD) | met | чат `/chat`, продукт «Подбор вакансий» |

API: `GET /api/jobs/med/map-role?title=`, `POST /api/jobs/med/profiles`, `GET /api/jobs/med/profiles/stats`, `GET /api/jobs/med/profiles/:id`  
Consent draft: `docs/med/CONSENT_DRAFT.md` (A в чате; B отложен).

### Phase 3.1 (2026-08-26) — Med живёт в чате, а не на отдельных страницах

Отдельные страницы `/med` и `/med/profile` **удалены**: вход в продукт один — лендинг → карточка «Подбор вакансий» → чат.

| Слой | Как работает |
|------|--------------|
| Развилка | Первый ответ про роль или карьеру → `GET /api/jobs/med/map-role` → `medDetected` в `collectedData` → шаг подтверждения: `med_confirm` (быстрый путь), `med_confirm_career` (после «расскажите о карьере»), `med_confirm_pref` (поздний вопрос о должности) |
| Подтверждение | «да» → ветка `med_*`; «нет» → `medRoleId` очищается, кандидат идёт обычным путём |
| Профиль | `med_skills` → `med_experience` → `med_documents` → `med_city` → `med_employment` → `med_consent` → `med_ready` |
| Consent A | Шаг `med_consent`; при «да» — `POST /api/jobs/med/profiles`, `medProfileId` в сессии |
| Вакансии | Та же панель «Вакансии»: `getMatchedJobs` видит `medRoleId` в `collectedData` и берёт кандидатов из `findMedFeed` вместо IT-семейств |
| Навыки для матча | Таксономия (с правками кандидата) пишется в `skills_hard` — обычный matcher скорит мед-вакансии |

Fail-open: недоступный `map-role`, выключенный `ENABLE_MED_VERTICAL` или отказ на подтверждении возвращают кандидата в обычный подбор.

### §6.1 Связка: вакансия ↔ `med_roles` ↔ таксономия

**Статус (2026-08-26):** ✅ закрыто для in-scope taxonomy (181/181 mapped).

| Каталог | Было | Стало |
|---------|------|-------|
| `med_roles.json` | 196 (только 434н) | **233** (434н + 37 `ext:*`) |
| taxonomy → `med_role_id` | 144 mapped / 37 unmapped | **181 / 0** |

Расширение v1: провизоры / фармацевт, главный врач и др. руководящие, сиделка / няня / санитар-водитель, ассистенты, биолог/эмбриолог и пр. из `taxonomy_meditsina_rf.md`.  
`nomenclature_ref`: `5.*`/`6.*`/`9.*`/`12.*` = 434н; `ext:pharma` \| `ext:taxonomy_rf` \| `ext:market` = вне 434н.

**Связка:** вакансия → `mapRole.ts` → `med_role_id`; role → taxonomy (`npm run med:generate-taxonomy`).

### Чего не делать сразу

- Не смешивать мед-вертикаль в общий Jack без явной развилки (шум для IT-аудитории): вход — авто-детект + подтверждение на шаге `med_confirm`.
- Не обещать «все вакансии России».
- Не строить B2B до работающего магнита и онбординга.
- Не тащить Kabi в Med-трек.
- Не обещать в UI показ клиникам, пока нет consent B + политики оператора.

---

## 7. Ещё открыто / next

| # | Тема | Статус |
|---|------|--------|
| 1 | Consent copy | Черновик + UI consent A; реквизиты оператора / юрист — перед продом |
| 2 | Порог N | Мягкие вехи 10/50/100+; stats API |
| 3 | TG-бот vs web | Phase 3 = web; бот = эволюция |
| 4 | Фарма + руководство + junior extras | Закрыто |
| 5 | `qualifications[]` из приказов | Не блокер; в UI спрашиваем документы у юзера |

---

## 8. Одной фразой

ТЗ жены = **GTM мед. вертикали LEO Med**: агрегатор вакансий по профессиям (врачи + средний + младший + фарма/руководство/junior extras, РФ) → структурированный профиль → база специалистов (метрика = N профилей; показ клиникам — отдельно).
