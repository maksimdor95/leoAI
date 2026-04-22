# LEO AI -- Продуктовое видение

Единый документ продуктовой стратегии и бизнес-плана платформы LEO AI.

---

## 1. Видение продукта

**Миссия:** создать AI-агента, который управляет карьерой пользователя -- от анализа навыков до автоматического поиска и получения предложений о работе.

**Финальная модель:** работа ищет пользователя; пользователь выбирает предложения, а не ищет их.

**Главный актив:** карьерные данные -- навыки, карьерные цели, ответы на интервью, история обучения и откликов (Career Graph: Users -- Skills -- Tools -- Jobs -- Learning).

**Технологии:** YandexGPT, Docker Compose, Yandex Cloud Serverless Containers.

---

## 2. Стратегические слои

### Слой 1 -- AI Career Learning (текущий фокус)

Освоение AI-инструментов, понимание влияния AI на профессию, развитие навыков, построение карьерного плана. Цель -- привлечение аудитории и сбор карьерных профилей.

AI-обучение -- не основной бизнес, а воронка привлечения. Через обучение платформа собирает данные о навыках и формирует talent pool для последующего подбора вакансий и карьерного маркетплейса.

### Слой 2 -- AI Career Agent (будущее)

Пользователь не ищет вакансии самостоятельно. Система подбирает и предлагает позиции. Пользователь выбирает из предложений.

---

## 3. Этапы развития продукта (User Journey)

### Stage 1 -- MVP 0 (Delivery Focus) [В работе]

- Обязательный результат MVP 0: **два co-primary** пути (Jack и WannaNew) — у каждого стабильный end-to-end `chat/interview -> финальный артефакт` (см. `IMPROVEMENT_PLAN.md`, 2026-04-18).
- Приоритетные пути:
  - Jack: `Профиль -> подбор вакансий -> email`.
  - WannaNew: `Интервью -> report preview -> PDF`.
- Требование релиза: security/reliability baseline + smoke gate + runbook выкладки.
- **Инженерные статусы (единый словарь):** `Implemented / Partial / Planned` — сводка по компонентам в `DEVELOPMENT_PLAN.md`, срез работ в `IMPROVEMENT_PLAN.md`.

**Статус:** core платформа в части функций **Partial** в терминах `DEVELOPMENT_PLAN.md`; фокус до релиза — стабилизация и эксплуатационная готовность.

### Stage 2 -- Career Development Platform [В планах]

- События, комьюнити, карьерные треки.
- Портфолио навыков, начало talent marketplace.

### Stage 3 -- Talent Marketplace [В планах]

- Работодатели ищут специалистов.
- Специалисты получают предложения.
- Пользователь может искать вакансии сам.

### Stage 4 -- AI Career Agent [В планах]

- AI анализирует рынок вакансий, подбирает позиции, отправляет отклики.
- Пользователь получает приглашения и выбирает предложения.

---

## 4. AI-агенты

Все агенты работают вокруг единого Career Profile пользователя.

### 4.1. Сценарий LEO "Поиск вакансий" (`product=jack`) [Реализовано]

- Поиск вакансий через HH.ru API.
- Диалоговый интерфейс для уточнения предпочтений.
- Голосовой ввод через Web Speech API.

### 4.2. Сценарий LEO "PM-интервью" (`product=wannanew`) [Реализовано]

- Подготовка PM к собеседованиям.
- Анализ опыта кандидата через диалог.
- Генерация PDF-отчета с оценкой, рекомендациями и типовыми вопросами.
- Голосовое пробное интервью.

### 4.3. Resume Agent [В планах]

- Анализ загруженного резюме, выявление сильных/слабых сторон.
- Улучшение структуры и формулировок, генерация нового резюме.
- AI Resume Builder: если нет резюме -- AI проводит интервью и генерирует его.
- Снижает барьер входа в продукт.

### 4.4. Skills Analysis Agent [В планах]

- Построение skills graph пользователя.
- Извлечение навыков из резюме и интервью.
- Оценка уровня навыков, формирование AI Readiness Score и skill gaps.

### 4.5. Career Path Agent [В планах]

- Анализ карьерного профиля (роль, навыки, цели).
- Определение карьерных направлений и необходимых навыков.
- Пример: Marketing Manager -> AI Marketing Specialist, Growth Manager.

### 4.6. Learning Agent [В планах]

- Персональный план изучения AI-инструментов.
- Learning roadmap (недели, модули, шаги).
- Маппинг программ обучения на skill gaps.

### 4.7. Будущие агенты

- **Job Matching Agent** -- подбор вакансий под Career Profile, ранжирование и объяснение релевантности. [Частично реализовано в MVP 0]
- **Interview Agent** -- симуляция интервью, генерация вопросов, подготовка ответов с использованием Interview Memory. [В планах]

---

## 5. Единый карьерный профиль и Interview Memory

**Career Profile** -- центральный объект системы:
- Резюме (загруженное или сгенерированное AI).
- Навыки и AI-навыки, карьерные цели.
- Learning roadmap, история обучения.
- Ответы на интервью.

**Interview Memory** хранит ответы пользователя на типовые карьерные вопросы. Позволяет не задавать одни и те же вопросы повторно, автоматически готовить к интервью, генерировать резюме и сопроводительные письма.

---

## 6. Career Data Model

### 6.1. Основные сущности

| Сущность | Описание |
|---|---|
| User | user_id, email, name, location, current_role, experience_years |
| CareerProfile | current_role, target_role, industry, ai_readiness_score, career_summary |
| Resume | resume_text, parsed_data (experience, education, skills, projects) |
| Skills | skill_name, skill_category (technical, ai_tools, soft_skills, domain, business) |
| UserSkills | skill_id, skill_level, confidence_score, source (resume / self_assessment / ai_inference) |
| Experience | company, role, start_date, end_date, description, skills_used |
| AI Tools | tool_name, category, description, skill_tags |
| Learning Programs | title, difficulty, duration, skills_taught, tools_covered |
| LearningPlan / LearningSteps | plan_id, steps с статусами (not_started / in_progress / completed) |
| Career Goals | target_role, target_industry, time_horizon, priority_level |
| AI Readiness Score | score, skills_gap, recommended_skills |
| Interview Answers | question, answer, confidence_score |
| Jobs (будущее) | title, company, required_skills, salary_range |
| Job Matches (будущее) | user_id, job_id, match_score |

### 6.2. Поток данных

Регистрация -> загрузка/создание резюме -> Resume Agent парсит резюме (Resume, Experience, UserSkills) -> Skills Analysis Agent считает AI Readiness Score и skill gaps -> Career Path Agent предлагает направления -> Learning Agent создает LearningPlan -> все синхронизируется в CareerProfile.

### 6.3. Минимальная модель для MVP

User, CareerProfile, Resume, Skills, UserSkills, AI Tools, LearningPlan, LearningSteps.

---

## 7. Skills Taxonomy

4-уровневая иерархия: Category -> Group -> Skill -> Subskill.

### 7.1. Категории (Level 1)

AI Skills, Technical Skills, Business Skills, Domain Skills, Soft Skills, Tools.

### 7.2. Группы (Level 2, пример для AI Skills)

Prompt Engineering, AI Automation, AI Data Analysis, AI Content Creation, AI Product Development.

### 7.3. Навыки (Level 3, пример для Prompt Engineering)

Prompt Design, Prompt Optimization, Prompt Evaluation.

### 7.4. Поднавыки (Level 4, пример для Prompt Design)

Writing system prompts, Writing task prompts, Structuring prompts.

### 7.5. Слой AI Tools

Каждый инструмент привязан к навыкам:
- ChatGPT -> Prompt Engineering, AI Writing, AI Research
- Midjourney -> AI Image Generation, Visual Prompting
- Notion AI -> AI Productivity, Knowledge Management

### 7.6. Уровни владения

Beginner -> Intermediate -> Advanced -> Expert (или числовая шкала 1-5).

### 7.7. Связи в системе

- **User <-> Skills** -- набор навыков с уровнями.
- **Role <-> Skills** -- каждая профессия описывается набором навыков.
- **Learning Program <-> Skills** -- программы помечены развиваемыми навыками.
- **Job <-> Skills** -- вакансии используют ту же таксономию.
- **AI Agents <-> Taxonomy** -- Resume Agent маппит на навыки, Skills Analysis считает уровни, Career Path рассчитывает переходы, Learning строит план, Job Matching сравнивает.

### 7.8. MVP таксономия

Объем: 50-100 навыков. Основные категории: AI tools, AI skills, Digital skills, Business skills. Старт: топ AI-инструменты -> выделить навыки -> сгруппировать.

---

## 8. Бизнес-стратегия

### 8.1. Фазы роста

| Фаза | Период | Цель | Ключевые метрики |
|---|---|---|---|
| 1. Production-Ready MVP | 0-3 мес. | Полный цикл value delivery, закрытая бета | 500+ пользователей, matching accuracy >70% |
| 2. Публичный запуск | 4-6 мес. | Масштабирование базы, начало B2B | 5 000+ пользователей, MRR $10K+ |
| 3. Подготовка к инвестициям | 7-9 мес. | Product-market fit, seed раунд | 10 000+ пользователей, MRR $50K+ |
| 4. Масштабирование | 10-12 мес. | Рост с привлеченными инвестициями | 50 000+ пользователей, ARR $1M+ |

### 8.2. Ценообразование

**B2C (Freemium):**
- Free -- базовый доступ, 5 вакансий в неделю.
- Premium ($9.99/мес.) -- неограниченные вакансии, приоритет в matching, карьерный коучинг.

**B2B (Subscription + Success Fee):**
- Starter ($500/мес.) -- доступ к 100 кандидатам, базовый matching.
- Professional ($1 500/мес.) -- неограниченный доступ, priority matching, analytics.
- Enterprise ($5 000+/мес.) -- кастомные интеграции, dedicated support.
- Success fee: 10-15% от годовой зарплаты при успешном найме.

### 8.3. Стратегия выхода на рынок

**B2C (кандидаты):** контент-маркетинг (Habr, VC.ru, YouTube), соцсети (VK, Telegram, LinkedIn), партнерства с карьерными сообществами, SEO, реферальная программа.

**B2B (компании):** outbound sales, HR-конференции, inbound marketing (case studies, вебинары), account-based marketing.

**Целевая аудитория:** IT-специалисты, менеджеры среднего звена, 25-45 лет, Москва/СПб/города-миллионники.

---

## 9. Конкурентные преимущества

1. AI-first подход -- глубокое понимание кандидатов через диалоги.
2. Двусторонняя платформа -- сетевые эффекты между кандидатами и компаниями.
3. Качество данных -- мультиагентная система валидации и анализа.
4. Персонализация -- уникальный опыт для каждого пользователя.
5. YandexGPT -- нативная поддержка русского языка и рынка России/СНГ.

---

## 10. Целевые метрики

### Продуктовые

- Регистрации: 10 000+/мес.
- Завершенные диалоги: 5 000+/мес.
- Retention rate: 40%+ (месячный).
- NPS: 50+.
- Conversion (диалог -> трудоустройство): >15%.

### Бизнес

- CAC: <$20 (кандидаты), <$500 (компании).
- LTV: >$100 (кандидаты), >$10 000 (компании).
- LTV/CAC ratio: >5.
- Gross margin: >70%.

### Технические

- Uptime: >99.9%.
- API response time: <200ms (p95).
- Matching accuracy: >75%.

---

## 11. Риски и митигация

| Риск | Митигация |
|---|---|
| Конкуренция с HH.ru, Avito Jobs | Фокус на AI и персонализацию, позиционирование как премиум-решение |
| Регуляторные риски (152-ФЗ, персональные данные) | Compliance с самого начала, юридическая поддержка |
| Сложность масштабирования matching | Итеративная разработка, A/B тестирование, user feedback |
| Недостаток финансирования | Bootstrap до первых метрик, затем привлечение инвесторов |
| Отсутствие критической массы пользователей | Фокус на узкую нишу (IT), затем расширение |

---

## 12. Инвестиции и exit

### Seed раунд (месяц 9)

- Целевая сумма: $500K-$1M.
- Использование: команда (60%), маркетинг (25%), инфраструктура (15%).
- Целевые метрики: MRR $50K+, 15 000+ пользователей, 100+ компаний-клиентов.

### Exit strategy

Строить отношения с потенциальными покупателями: HH.ru (HeadHunter), Avito, международные HRTech (Workday, Greenhouse). При ARR $1M -- valuation $10-15M (10-15x ARR).

---

## 13. Текущий статус реализации

| Компонент | Статус |
|---|---|
| Сценарий LEO "Поиск вакансий" (`product=jack`) | Реализовано |
| Сценарий LEO "PM-интервью" (`product=wannanew`) | Реализовано |
| Голосовой ввод (Web Speech API) | Реализовано |
| Онбординг карьерного профиля | Реализовано |
| Docker Compose + Yandex Cloud Serverless | Реализовано |
| YandexGPT интеграция | Реализовано |
| Resume Agent | В планах |
| Skills Analysis Agent | В планах |
| Career Path Agent | В планах |
| Learning Agent | В планах |
| Векторный поиск (Qdrant) | В планах |
| B2B сервис (Jill) | В планах |
| Mobile app | В планах |
| LinkedIn/Indeed scraping | В планах |
