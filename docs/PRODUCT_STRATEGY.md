## AIheroes — Product Strategy & Architecture

Этот документ фиксирует продуктовое видение новой карьерной AI‑платформы AIheroes и служит единым референсом для последующей разработки и промптов.

Структура:
- **1. Product Strategy**
- **2. AI Agent Architecture**
- **3. Career Data Model**
- **4. Skills Taxonomy**
- **5. Product Screen Architecture (MVP)**

---

## 1. Product Strategy

### 1.1. Strategic Layers

- **Layer 1 — AI Career Learning Funnel (current focus)**  
  - Освоение AI‑инструментов специалистами.  
  - Понимание влияния AI на профессию.  
  - Развитие новых навыков.  
  - Построение карьерного плана.  
  - **Цель слоя**: привлечение и формирование аудитории специалистов, сбор данных и профилей (воронка в стиле Ivee.jobs).

- **Layer 2 — AI Career Agent (future)**  
  - Пользователь не ищет вакансии самостоятельно.  
  - Система подбирает и предлагает вакансии.  
  - Пользователь выбирает из предложений.  
  - **Ключевая идея**: работа ищет пользователя; пользователь **выбирает предложения, а не ищет их**.

### 1.2. Role of AI Learning

- **AI‑обучение — не основной бизнес**, а стратегическая воронка привлечения пользователей.  
- Через обучение AI‑инструментам платформа:
  - привлекает специалистов;
  - собирает данные о навыках;
  - формирует карьерные профили;
  - создает talent pool.
- **Talent pool** в дальнейшем используется для:
  - подбора вакансий;
  - работы AI‑карьерного агента;
  - формирования карьерного маркетплейса.

### 1.3. User Journey (Stages)

- **Stage 1 — AI Career Learning Platform (MVP)**  
  - Пользователь заходит на платформу → регистрируется.  
  - Загружает резюме **или** создает его через AI (AI Resume Builder).  
  - Получает AI‑анализ навыков.  
  - Получает **AI Readiness Score**.  
  - Получает **learning roadmap** по AI‑инструментам.  
  - Проходит обучение и программы.  
  - Формируется единый карьерный профиль.  
  - **Результат для платформы**: структурированный карьерный профиль пользователя.

- **Stage 2 — Career Development Platform**  
  - Добавляются события и комьюнити.  
  - Появляются карьерные треки.  
  - Формируется портфолио навыков.  
  - Начинается формирование talent marketplace.

- **Stage 3 — Talent Marketplace**  
  - Появляется функциональность:
    - работодатели ищут специалистов;
    - специалисты получают предложения;
    - пользователь все еще может искать вакансии сам.

- **Stage 4 — AI Career Agent**  
  - AI анализирует рынок вакансий.  
  - AI подбирает релевантные позиции.  
  - AI отправляет отклики и взаимодействует с работодателями.  
  - Пользователь получает приглашения и **выбирает предложения**.

### 1.4. Unified Career Profile & Interview Memory

- **Unified Career Profile**:
  - резюме (загруженное или сгенерированное AI);
  - навыки и AI‑навыки;
  - карьерные цели;
  - learning roadmap;
  - история обучения;
  - ответы на интервью.  
  - Это главный объект системы и база для AI‑агентов.

- **Interview Memory**:
  - хранит ответы пользователя на типовые карьерные вопросы (расскажите о себе, достижения, мотивация смены работы и т.п.);
  - позволяет:
    - автоматически готовить к интервью;
    - не задавать одни и те же вопросы много раз;
    - использовать ответы для генерации резюме, сопроводительных писем и подготовки к интервью.

### 1.5. Final Strategic Principle

- **AI‑обучение** — механизм привлечения и сбора данных.  
- **Цель продукта** — создать AI‑агента, который **управляет карьерой пользователя**.  
- **Финальная модель**:  
  - Работа ищет пользователя.  
  - Пользователь выбирает предложения.  
- **Главный актив** — карьерные данные: навыки, карьерные цели, ответы на интервью, история обучения и откликов → **Career Graph** (Users–Skills–Tools–Jobs–Learning).

---

## 2. AI Agent Architecture

Все агенты работают вокруг **единого Career Profile** пользователя.

User  
↓  
Career Profile  
↓  
AI Agents

### 2.1. Agent 1 — Resume Agent

- **Назначение**: создание и улучшение резюме.  
- **Функции**:
  - анализ загруженного резюме;
  - выявление сильных и слабых сторон;
  - улучшение структуры и формулировок;
  - генерация нового резюме.  
- **AI Resume Builder сценарий** (если нет резюме):
  - пользователь нажимает «У меня нет резюме»;
  - AI проводит интервью (места работы, задачи, результаты, навыки);
  - AI генерирует резюме.  
- **Роль**: снижает барьер входа в продукт.

### 2.2. Agent 2 — Skills Analysis Agent

- **Назначение**: построение **skills graph** пользователя.  
- **Функции**:
  - извлечение навыков из резюме и интервью;
  - оценка уровня навыков (skills + AI‑skills);
  - формирование AI Readiness Score и списка skill gaps.  
- **Результат**:
  - структура `Skill–Level–Category`;
  - база для рекомендаций по обучению и переходам в карьере.

### 2.3. Agent 3 — Career Path Agent

- **Назначение**: формирование карьерного плана развития.  
- **Функции**:
  - анализ карьерного профиля (current role, skills, goals);
  - определение возможных карьерных направлений (AI‑ролей и смежных путей);
  - генерация списка возможных ролей и необходимых навыков.  
- **Пример**: из `Marketing Manager` → `AI Marketing Specialist`, `Growth Manager`, `AI Product Marketing Manager`.

### 2.4. Agent 4 — Learning Agent

- **Назначение**: построение персонального плана изучения AI‑инструментов (core воронки).  
- **Функции**:
  - определяет, какие AI‑инструменты и навыки нужны под цели пользователя;
  - формирует **learning roadmap** (недели, модули, шаги);
  - маппит программы обучения и AI‑tools на skill gaps.  
- **Результат**: структурированный AI Learning Plan (по неделям, навыкам и инструментам).

### 2.5. Future Agents

- **Agent 5 — Job Matching Agent (future)**:
  - анализирует вакансии (skills, уровень, зарплата, формат работы);
  - подбирает вакансии под Career Profile и AI Readiness;
  - ранжирует и объясняет, почему вакансия подходит.

- **Agent 6 — Interview Agent (future)**:
  - анализирует вакансию и роль;
  - генерирует типовые вопросы;
  - подготавливает ответы с использованием Interview Memory;
  - симулирует интервью и дает фидбек.

### 2.6. What We Need Now (MVP)

- Для первой версии достаточно 4 агентов:
  - **Resume Agent**;
  - **Skills Analysis Agent**;
  - **Career Path Agent**;
  - **Learning Agent**.  
- **Job Matching Agent** и **Interview Agent** появляются на стадиях Talent Marketplace и AI Career Agent.

---

## 3. Career Data Model

Все данные строятся вокруг **Career Profile** пользователя; это центральный объект, который используют все AI‑агенты.

### 3.1. Core Entities

- **User**
  - `user_id`
  - `email`
  - `name`
  - `location`
  - `current_role`
  - `experience_years`
  - `created_at`
  - Связи: `User → CareerProfile`, `User → Resume`, `User → LearningProgress`.

- **Career Profile**
  - `profile_id`
  - `user_id`
  - `current_role`
  - `target_role`
  - `industry`
  - `experience_level`
  - `ai_readiness_score`
  - `career_summary`
  - Связи:
    - `CareerProfile → Skills`
    - `CareerProfile → Experience`
    - `CareerProfile → LearningPlan`
    - `CareerProfile → CareerGoals`
    - `CareerProfile → InterviewAnswers`.

- **Resume**
  - `resume_id`
  - `user_id`
  - `resume_text`
  - `parsed_data` (experience, education, skills, projects)
  - `created_at`
  - Используется **Resume Agent**.

- **Skills**
  - `skill_id`
  - `skill_name`
  - `skill_category` (technical, ai_tools, soft_skills, domain_skills, business и т.п.).

- **User Skills**
  - `user_skill_id`
  - `user_id`
  - `skill_id`
  - `skill_level`
  - `confidence_score`
  - `source` (`resume`, `self_assessment`, `ai_inference`, `learning`).

- **Experience**
  - `experience_id`
  - `user_id`
  - `company`
  - `role`
  - `start_date`
  - `end_date`
  - `description`
  - `skills_used`.

- **AI Tools**
  - `tool_id`
  - `tool_name`
  - `category`
  - `description`
  - `skill_tags` (связь с taxonomy).

- **Learning Programs**
  - `program_id`
  - `title`
  - `description`
  - `difficulty`
  - `duration`
  - `skills_taught`
  - `tools_covered`.

- **Learning Plan**
  - `plan_id`
  - `user_id`
  - `generated_by_ai`
  - `created_at`.

- **Learning Steps**
  - `step_id`
  - `plan_id`
  - `program_id`
  - `status` (`not_started`, `in_progress`, `completed`)
  - `completion_date`.

- **Career Goals**
  - `goal_id`
  - `user_id`
  - `target_role`
  - `target_industry`
  - `time_horizon`
  - `priority_level`.

- **AI Readiness Score**
  - `score_id`
  - `user_id`
  - `score`
  - `skills_gap`
  - `recommended_skills`.  
  - Генерируется **Skills Analysis Agent**.

- **Interview Answers**
  - `answer_id`
  - `user_id`
  - `question`
  - `answer`
  - `confidence_score`.

- **Jobs (future)**
  - `job_id`
  - `title`
  - `company`
  - `location`
  - `required_skills`
  - `salary_range`
  - `description`.

- **Job Matches (future)**
  - `match_id`
  - `user_id`
  - `job_id`
  - `match_score`
  - `recommended_at`.

### 3.2. Data Flow (High‑Level)

User registers  
↓  
Resume uploaded **или** AI Resume Builder  
↓  
Resume Agent парсит резюме → создает `Resume`, `Experience`, `UserSkills`  
↓  
Skills Analysis Agent считает `AI Readiness Score` и skill gaps  
↓  
Career Path Agent предлагает карьерные направления  
↓  
Learning Agent создает `LearningPlan` и `LearningSteps`  
↓  
Все данные синхронизируются в `CareerProfile`.

### 3.3. Minimal Data Model for MVP

- **Обязательные сущности для первой версии**:
  - `User`
  - `CareerProfile`
  - `Resume`
  - `Skills`
  - `UserSkills`
  - `AI Tools`
  - `LearningPlan`
  - `LearningSteps`.

---

## 4. Skills Taxonomy

### 4.1. Purpose

- **Skills taxonomy** — стандартизированная система навыков для всей платформы.  
- Используется для:
  - анализа резюме;
  - понимания навыков;
  - построения карьерных траекторий;
  - рекомендаций по обучению;
  - подбора вакансий.  
- Все AI‑агенты используют **единую taxonomy**.

### 4.2. Structure

Иерархия:

Skill Category  
↓  
Skill Group  
↓  
Skill  
↓  
Subskill

- **Level 1 — Skill Categories** (пример):
  - AI Skills  
  - Technical Skills  
  - Business Skills  
  - Domain Skills  
  - Soft Skills  
  - Tools.

- **Level 2 — Skill Groups** (пример для AI Skills):
  - Prompt Engineering  
  - AI Automation  
  - AI Data Analysis  
  - AI Content Creation  
  - AI Product Development.

- **Level 3 — Skills** (пример для Prompt Engineering):
  - Prompt Design  
  - Prompt Optimization  
  - Prompt Evaluation.

- **Level 4 — Subskills** (пример для Prompt Design):
  - Writing system prompts  
  - Writing task prompts  
  - Structuring prompts.

### 4.3. AI Tools Layer

- Отдельный слой **AI tools**, связанный с навыками.  
- Пример:
  - ChatGPT → Prompt Engineering, AI Writing, AI Research  
  - Midjourney → AI Image Generation, Visual Prompting  
  - Notion AI → AI Productivity, Knowledge Management.

### 4.4. Skill Levels

- Уровни:
  - Beginner  
  - Intermediate  
  - Advanced  
  - Expert  
  - (опционально — числовая шкала Level 1–5).

### 4.5. Connections

- **User ↔ Skills**:  
  - каждый пользователь имеет набор skills из taxonomy с уровнями.  

- **Role ↔ Skills**:  
  - каждая профессия описывается набором skills (например, `AI Marketing Specialist`: Marketing Strategy, Prompt Engineering, AI Content Creation, AI Analytics).

- **Learning Program ↔ Skills**:  
  - каждая программа обучения помечена skills, которые она развивает → позволяет строить learning roadmap и измерять прогресс.

- **Job ↔ Skills (future)**:  
  - вакансии используют ту же taxonomy (`required_skills`).

- **AI Agents ↔ Taxonomy**:
  - Resume Agent — маппит резюме/ответы на skills из taxonomy;  
  - Skills Analysis Agent — считает уровни и gaps;  
  - Career Path Agent — использует taxonomy для расчета переходов `current skills → target role`;  
  - Learning Agent — строит план обучения на базе `missing skills`;  
  - Job Matching Agent — сравнивает `user skills` vs `job skills`.

### 4.6. Minimal Taxonomy for MVP

- **Объем**: 50–100 skills.  
- **Основные категории**:
  - AI tools  
  - AI skills  
  - Digital skills  
  - Business skills.  
- Старт: взять топ AI‑инструменты (ChatGPT, Midjourney, Notion AI, Runway, Zapier AI, Perplexity, Claude) → выделить навыки их использования → сгруппировать.

---

## 5. Product Screen Architecture (MVP)

### 5.1. High-Level Map

- Landing  
- Authentication  
- Onboarding  
- Resume Upload / AI Resume Builder  
- Resume Analysis & AI Readiness Score  
- Career Insights  
- Learning (Tools Library, Programs, Roadmap)  
- Dashboard  
- Career Profile  
- Settings  
- (Future: Jobs, Employer Dashboard, Job Agent, Interview Agent).

Всего: **25–30 экранов** в полном MVP; **12 экранов** для быстрого запуска.

### 5.2. Landing & Authentication

- **Screen 1 — Landing Page**
  - Цель: объяснить ценность продукта и завести в AI‑анализ карьеры.
  - Блоки: Hero, How it works, AI tools you will learn, Career transformation, Testimonials, CTA.  
  - CTA: **«Start AI Career Analysis»**.

- **Screen 2 — About Platform**
  - Объясняет, как AI меняет карьеры и как работает платформа.

- **Screen 3 — AI Tools Overview**
  - Список AI‑инструментов (ChatGPT, Midjourney, Runway, Notion AI, Perplexity и т.д.).

- **Screen 4 — Sign Up**
  - Поля: `email`, `password`, `name`.

- **Screen 5 — Login**
  - Поля: `email`, `password`.

### 5.3. Onboarding

- **Screen 6 — Welcome Screen**
  - Сообщение: «Let's analyze your career and AI skills».  
  - Кнопка: **Start analysis**.

- **Screen 7 — Career Question 1**
  - Вопрос: текущая роль (`current_role`).

- **Screen 8 — Career Question 2**
  - Вопрос: годы опыта (`experience_years`).

- **Screen 9 — Career Goal**
  - Вопрос: целевая роль (`target_role`).

- **Screen 10 — Resume Upload**
  - Опции:
    - Upload resume;
    - Create resume with AI (AI Resume Builder).

- **Screen 11 — AI Resume Interview**
  - Если нет резюме — диалог: места работы, задачи, достижения, навыки → генерация резюме.

### 5.4. Resume Analysis & Career Insights

- **Screen 12 — Resume Parsing**
  - Loading‑экран анализа резюме.

- **Screen 13 — Skills Extracted**
  - Список извлеченных навыков.

- **Screen 14 — AI Skills Analysis**
  - Специальный блок по AI‑навыкам (Prompting, AI automation, AI analytics и т.д.).

- **Screen 15 — AI Readiness Score (Key Screen)**
  - Основной вау‑экран.
  - Пример: `42 / 100`, описание уровня готовности, ключевые выводы.

- **Screen 16 — Career Opportunities**
  - Рекомендуемые карьерные направления на основе профиля.

- **Screen 17 — Skill Gaps**
  - Список навыков, которые нужно развить для выбранных путей.

### 5.5. Learning

- **Screen 18 — Learning Roadmap**
  - Недели/модули, привязанные к skill gaps и AI‑инструментам.

- **Screen 19 — AI Tools Library**
  - Каталог AI‑инструментов; фильтры по категории, профессии, уровню сложности.

- **Screen 20 — Tool Page**
  - Карточка одного инструмента: what it is, how professionals use it, examples, tutorial.

- **Screen 21 — Learning Programs**
  - Каталог программ: AI for Marketing, AI for PM, AI for Designers и т.п.

- **Screen 22 — Program Page**
  - Детальная страница программы: что вы выучите, skills, tools, duration.

### 5.6. Dashboard, Profile, Settings

- **Screen 23 — User Dashboard**
  - Главный экран после onboarding:
    - AI Readiness Score;
    - Learning roadmap кратко;
    - Recommended tools;
    - Career insights.

- **Screen 24 — Career Profile**
  - Единый профиль:
    - Resume;
    - Skills & AI skills;
    - Career goals;
    - Learning progress;
    - (позже — Interview Memory, Job history).

- **Screen 25 — Account Settings**
  - Name, email, password и базовые настройки.

### 5.7. Minimal vs Full MVP

- **Minimal MVP (≈12 screens)**:
  - Landing, Sign Up / Login;  
  - Onboarding (role, experience, goal);  
  - Resume Upload / AI Resume Builder;  
  - Resume Analysis;  
  - AI Readiness Score;  
  - Skill Gaps;  
  - Learning Roadmap;  
  - Dashboard;  
  - Profile.

- **Full MVP (≈25 screens)**:
  - Включает AI Tools Library, Programs, детальные страницы, расширенные карьерные инсайты и профиль.

### 5.8. Future Product Surfaces

- Jobs marketplace (Talent Marketplace).  
- Employer dashboard.  
- AI job agent (автопоиск и отклики).  
- Interview preparation & Interview Agent.  

**Самый важный экран текущего продукта**: **AI Readiness Score** → он создает вау‑эффект, мотивирует учиться и ведет в learning roadmap.

