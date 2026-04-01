# Stage 1 — Чеклист по шагам плана разработки

План из запроса: шесть шагов с одобрением после каждого. Ниже статус шагов 1–3 и что осталось для 4–6.

---

## Шаг 1 — Вертикальный срез MVP (Промпт 1)

**Требования:**  
Landing → Sign up/Login → Onboarding (роль, опыт, цель) → Resume Upload / «У меня нет резюме» → AI Resume Interview (заглушки) → экран AI Readiness Score (статический mock).  
Бэкенд: User, CareerProfile, сохранение резюме текстом, фейковый ai_readiness_score.

| Критерий | Статус | Где |
|----------|--------|-----|
| Landing с CTA в онбординг | ✅ | `frontend/app/page.tsx` — блок «Start AI Career Analysis» → `/career/onboarding` |
| Sign up / Login | ✅ | `frontend/app/register`, HeroSection + AuthModal, `userAPI.register` / `userAPI.login` |
| Онбординг: роль, опыт, цель | ✅ | `frontend/app/career/onboarding/page.tsx` + `CareerQuestionStep` (currentRole, experienceYears, targetRole) |
| Resume Upload / «У меня нет резюме» | ✅ | `ResumeUploadStep` — textarea + кнопка «У меня нет резюме — создать с AI» |
| AI Resume Interview (заглушка) | ✅ | `ResumeInterviewStep` — форма из 4 вопросов, ответы только на клиенте |
| Экран AI Readiness Score (mock) | ✅ | `ReadinessScoreStep` + `fetchAiReadinessScore()` → бэкенд GET `/api/career/ai-readiness` |
| Создание User | ✅ | `POST /api/users/register`, `POST /api/users` (user-profile) |
| CareerProfile (создание/обновление) | ✅ | `POST /api/career/profile` (body: current_role, target_role, experience_years, resume_text) |
| Сохранение резюме текстом | ✅ | В том же `POST /api/career/profile` при передаче `resume_text`; фронт: `saveResume()` |
| Фейковый ai_readiness_score | ✅ | `GET /api/career/ai-readiness` возвращает статический score + summary + recommendations |
| Онбординг только для авторизованных | ✅ | На `/career/onboarding` при отсутствии токена — редирект на `/` и открытие модалки входа |

**Итог шага 1:** реализовано, добавлена проверка авторизации на странице онбординга.

---

## Шаг 2 — Фронт: онбординг и резюме (Промпт 2)

**Требования:**  
Экраны по 5.3–5.5: Welcome, Career Q1, Career Q2, Career Goal, Resume Upload / Create with AI, AI Resume Interview, AI Readiness Score. Next.js + Tailwind + Ant Design, клиентское состояние, вызовы к API (не только mock), тёмная тема.

| Критерий | Статус | Где |
|----------|--------|-----|
| Welcome | ✅ | `WelcomeStep` — «Давайте проанализируем вашу карьеру и AI-навыки», кнопка «Начать анализ» |
| Career Question 1 (current role) | ✅ | `CareerQuestionStep` field=`currentRole` |
| Career Question 2 (experience years) | ✅ | `CareerQuestionStep` field=`experienceYears` |
| Career Goal | ✅ | `CareerQuestionStep` field=`targetRole` |
| Resume Upload / Create resume with AI | ✅ | `ResumeUploadStep` — Dragger (заглушка), textarea, «У меня нет резюме» |
| AI Resume Interview (форма вопросов) | ✅ | `ResumeInterviewStep` — 4 вопроса, кнопка «Перейти к AI Readiness Score» |
| AI Readiness Score (mock-данные) | ✅ | `ReadinessScoreStep` — score, level, summary, recommendations |
| Стек: Next.js, Tailwind, Ant Design | ✅ | App Router, Tailwind, Ant Design в компонентах и layout |
| Состояние онбординга на клиенте | ✅ | `useState` в `career/onboarding/page.tsx` (шаг, careerBasics, resumeText, interviewAnswers, scoreData) |
| Вызовы к API | ✅ | `saveCareerBasics`, `saveResume`, `fetchAiReadinessScore` в `lib/careerOnboardingMock.ts` → реальные запросы к user-profile |
| Тёмная тема как в чате | ✅ | Фон `#050913`, карточки `bg-white/[0.04]`, `border-white/10`, зелёные акценты |

**Итог шага 2:** реализовано.

---

## Шаг 3 — Бэкенд: минимальная модель данных и API (Промпт 3)

**Требования:**  
Сущности: User, CareerProfile, Resume, Skills, UserSkills, LearningPlan, LearningSteps. Схемы БД и TypeScript-типы. API: POST /api/users, POST /api/resume, GET /api/career-profile/:userId, POST /api/ai-readiness/mock.

| Критерий | Статус | Где |
|----------|--------|-----|
| User | ✅ | `jack.users`, `User.ts`, `userRepository.ts` |
| CareerProfile | ✅ | `jack.career_profiles`, `CareerProfile` в `CareerProfile.ts` |
| Resume | ✅ | `jack.resumes`, `Resume` в `CareerProfile.ts` |
| Skills | ✅ | `jack.skills`, `Skill` в `CareerProfile.ts` |
| UserSkills | ✅ | `jack.user_skills`, `UserSkill` в `CareerProfile.ts` |
| LearningPlan | ✅ | `jack.learning_plans`, `LearningPlan` в `CareerProfile.ts` |
| LearningSteps | ✅ | `jack.learning_steps`, `LearningStep` в `CareerProfile.ts` |
| Схемы БД | ✅ | `CareerService.createTables()` в `careerService.ts` |
| POST /api/users (регистрация онбординга) | ✅ | `userRoutes`: `router.post('/', ...)` при `app.use('/api/users', userRoutes)` |
| POST /api/resume | ✅ | `careerRoutes`: `router.post('/resume', ...)`, роут смонтирован как `app.use('/api', careerRoutes)` |
| GET /api/career-profile/:userId | ✅ | `careerRoutes`: `router.get('/career-profile/:userId', ...)` под `/api` |
| POST /api/ai-readiness/mock | ✅ | `careerRoutes`: `router.post('/ai-readiness/mock', ...)` под `/api` |
| Скор по количеству skills | ✅ | `CareerService.getMockAiReadinessFromSkills()` — score = 10 + skillsCount * 5, cap 100 |

**Итог шага 3:** реализовано. Список эндпоинтов выведен в корневой ответ сервиса (`GET /`).

---

## Шаг 4 — AI-агенты (промпт-шаблоны) — не начат

**Требование:**  
Один markdown-документ в `docs/` с промпт-шаблонами для четырёх агентов (Resume, Skills Analysis, Career Path, Learning): system prompt, входные данные, ожидаемый JSON, примеры. Без изменений кода.

**Статус:** не делался. После вашего одобрения можно добавить файл `docs/AI_AGENTS_PROMPTS.md`.

---

## Шаг 5 — Экран AI Readiness Score как центр продукта — не начат

**Требование:**  
Полноценный UI с большим score, сегментами (beginner/intermediate/advanced), блоками «Your AI skills today», «Your key gaps», «Next 3 steps»; эвристика по AI-skills и опыту; навигация к Learning Roadmap и Career Profile.

**Статус:** сейчас только базовый `ReadinessScoreStep` в онбординге. Отдельный центральный экран и навигация — не делались.

---

## Шаг 6 — Настрой проекта на новый продукт — не начат

**Требование:**  
Текстовый план: что переиспользуем из Jack/wannanew, что игнорируем, структура модулей (фронт, сервисы, данные), миграционный план в три этапа (вертикальный срез, AI Tools Library и Learning Programs, подготовка к Talent Marketplace). Без изменений кода.

**Статус:** не делался.

---

## Что изменено при проверке (шаги 1–3)

1. **Онбординг только для авторизованных:** на странице `/career/onboarding` добавлена проверка `isAuthenticated()`. При отсутствии токена — редирект на `/` и открытие модалки входа, сообщение «Войдите или зарегистрируйтесь, чтобы пройти онбординг».
2. **Описание API:** в корневой ответ User Profile Service (`GET /`) добавлены эндпоинты: `POST /api/users`, `POST /api/resume`, `GET /api/career-profile/:userId`, `GET /api/career/ai-readiness`, `POST /api/ai-readiness/mock`.

Дальше можно переходить к **шагу 4** (документ с промптами агентов) после вашего одобрения.
