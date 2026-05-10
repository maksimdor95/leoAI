import { ScenarioDefinition } from '../types/scenario';

export const INTERVIEW_PREP_SCENARIO: ScenarioDefinition = {
  id: 'interview-prep-v1',
  version: '2026-05-09',
  name: 'LEO Interview Prep — подготовка по вакансии',
  description:
    'AI-тренажер подготовки к собеседованию: профиль вакансии, план, теория, кейсы, мок-интервью и STAR.',
  entryStepId: 'vacancy_input',
  steps: [
    {
      id: 'vacancy_input',
      type: 'question',
      label: 'Вакансия для подготовки',
      instruction:
        'Попроси пользователя прислать текст вакансии, ссылку на вакансию или краткое описание роли. Если есть только ссылка, попроси вставить текст требований.',
      fallbackText:
        'Пришли ссылку, текст вакансии или опиши роль своими словами. Если это только ссылка, лучше сразу вставь ключевые требования: так я точнее соберу профиль вакансии и план подготовки.',
      placeholder: 'Вставь текст вакансии, ссылку или краткое описание роли...',
      collectKey: 'vacancyRawText',
      next: 'mode_select',
    },
    {
      id: 'mode_select',
      type: 'command',
      label: 'Выбор режима подготовки',
      commands: [
        { id: 'diagnostics', label: 'Диагностика', action: 'interview_mode:diagnostics' },
        { id: 'theory', label: 'Теория', action: 'interview_mode:theory' },
        { id: 'case', label: 'Кейс', action: 'interview_mode:case' },
        { id: 'mock', label: 'Мок-интервью', action: 'interview_mode:mock' },
        { id: 'star', label: 'STAR', action: 'interview_mode:star' },
        {
          id: 'employer_questions',
          label: 'Вопросы работодателю',
          action: 'interview_mode:employer_questions',
        },
      ],
      next: null,
    },
  ],
};
