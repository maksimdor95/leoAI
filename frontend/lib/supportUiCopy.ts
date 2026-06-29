import type { AppLocale } from '@/types/appSettings';

const copy = {
  ru: {
    consultationTitle: 'Получить консультацию',
    consultationSubtitle: 'Ответим за 2 часа. Без спама и навязчивых звонков.',
    writeUs: 'Написать нам →',
    writeUsModal: 'Написать нам',
    writeUsModalHint: 'Оставьте контакты — свяжемся в течение 2 часов.',
    teaserTitle: 'Есть вопрос?',
    teaserOnline: 'AI-ассистент онлайн',
    openConsultation: 'Открыть консультацию',
    closeConsultation: 'Закрыть консультацию',
    name: 'Имя',
    email: 'Email',
    phone: 'Телефон',
    service: 'Интересующая услуга',
    servicePlaceholder: 'Выберите услугу',
    message: 'Расскажите о задаче',
    messagePlaceholder: 'Опишите вашу задачу, текущие процессы и ожидаемый результат…',
    consent: 'Я соглашаюсь на обработку персональных данных в соответствии с',
    privacyPolicy: 'политикой конфиденциальности',
    submit: 'Отправить заявку',
    invalidEmail: 'Введите корректный email',
    consentRequired: 'Необходимо согласие на обработку данных',
    taskRequired: 'Опишите вашу задачу',
    leadSuccess: 'Заявка отправлена! Ответим в течение 2 часов.',
    leadError: 'Не удалось отправить заявку. Напишите нам в Telegram.',
    services: [
      'Подбор вакансий',
      'Подготовка к собеседованию',
      'Тренажёр интервью',
      'Корпоративное внедрение (B2B)',
      'Другое',
    ] as const,
  },
  en: {
    consultationTitle: 'Get a consultation',
    consultationSubtitle: 'We reply within 2 hours. No spam or pushy calls.',
    writeUs: 'Write to us →',
    writeUsModal: 'Write to us',
    writeUsModalHint: 'Leave your contacts — we’ll get back within 2 hours.',
    teaserTitle: 'Questions?',
    teaserOnline: 'AI assistant online',
    openConsultation: 'Open consultation',
    closeConsultation: 'Close consultation',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    service: 'Service of interest',
    servicePlaceholder: 'Select a service',
    message: 'Tell us about your task',
    messagePlaceholder: 'Describe your task, current process, and expected outcome…',
    consent: 'I agree to the processing of personal data under the',
    privacyPolicy: 'privacy policy',
    submit: 'Send request',
    invalidEmail: 'Enter a valid email',
    consentRequired: 'Consent is required',
    taskRequired: 'Describe your task',
    leadSuccess: 'Request sent! We’ll reply within 2 hours.',
    leadError: 'Could not send the request. Message us on Telegram.',
    services: [
      'Job matching',
      'Interview prep',
      'Interview trainer',
      'Enterprise (B2B)',
      'Other',
    ] as const,
  },
} as const;

export type SupportUiCopyKey = keyof Omit<(typeof copy)['ru'], 'services'>;

export function supportUi(locale: AppLocale, key: SupportUiCopyKey): string {
  return copy[locale][key];
}

export function supportServiceOptions(locale: AppLocale): string[] {
  return [...copy[locale].services];
}
