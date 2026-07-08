import type { AppLocale } from '@/types/appSettings';

const copy = {
  ru: {
    settings: 'Настройки',
    language: 'Язык',
    languageRu: 'Русский',
    languageEn: 'English',
    languageHint: 'Интерфейс и озвучка ответов',
    theme: 'Тема',
    themeLeo: 'LEO тёмная',
    themeHume: 'Hume светлая',
    speech: 'Озвучка ответов',
    speechHint: 'Голос LEO при ответах в чате',
    ttsLanguage: 'Язык озвучки',
    ttsLanguageRu: 'Русский',
    ttsLanguageEn: 'English',
    ttsVoice: 'Голос',
    myChats: 'Мои чаты',
    myChatsShort: 'Чаты',
    account: 'Профиль',
    accountTitle: 'Профиль',
    accountSubtitle: 'Вход и сохранённые диалоги привязаны к этой почте.',
    accountEmail: 'Почта',
    accountMemberSince: 'С нами с',
    accountAuthRequired: 'Войдите, чтобы открыть аккаунт.',
    accountLoadError: 'Не удалось загрузить данные аккаунта',
    logout: 'Выйти',
    logoutTip: 'Выйти из аккаунта',
    chatTitle: 'Чат с LEO',
    newChat: 'Новый чат',
    muteOn: 'Включить звук',
    muteOff: 'Выключить звук',
    connecting: 'Подключаемся к LEO...',
    connectingLeo: 'Подключаемся к Leo...',
    inputPlaceholder: 'Введите ответ…',
    inputListening: 'Слушаю...',
    inputSending: 'LEO анализирует ответ…',
    send: 'Отправить',
    profile: 'Профиль',
    prep: 'Подготовка',
    sidebarEmpty: 'Сообщения появятся здесь по мере диалога',
    editProfile: 'Профиль',
    tabChat: 'Чат',
    tabVacancies: 'Вакансии',
    tabMobileStage: 'Сценарий',
    tabMobileWorkspace: 'Диалог',
    mobileMainTabsAria: 'Сценарий и диалог',
    dialogueHistory: 'История диалога',
    sidebarSectionsAria: 'Разделы боковой панели',
    edit: 'Редактировать',
    editProfileModal: 'Редактировать профиль',
    save: 'Сохранить',
    cancel: 'Отмена',
    logoutConfirmTitle: 'Выход из аккаунта',
    logoutConfirmContent: 'Вы уверены, что хотите выйти?',
    logoutSuccess: 'Вы успешно вышли из аккаунта',
    profileEmptyJack:
      'Пока нет сохранённых ответов — продолжайте диалог слева: поля появятся здесь по мере заполнения анкеты.',
    formMessageRequired: 'Введите сообщение LEO',
    prepHistoryGeneral: 'Общее',
    chatsSubtitle: 'Выберите чат для продолжения или создайте новый',
    chatsEmpty: 'У вас пока нет чатов. Создайте новый, чтобы начать диалог.',
    chatsStartNew: 'Начать новый чат',
    chatsNewDialog: 'Новый диалог',
    chatsBackHome: 'На главную',
    chatsDeleteTitle: 'Удалить чат?',
    chatsDeleteOk: 'Удалить',
    chatsDeleteCancel: 'Отмена',
    chatsDeleted: 'Чат успешно удалён',
    chatsAuthRequired: 'Авторизуйтесь, чтобы просмотреть свои чаты.',
    chatsLoadError: 'Не удалось загрузить чаты',
    chatsDeleteError: 'Не удалось удалить чат',
  },
  en: {
    settings: 'Settings',
    language: 'Language',
    languageRu: 'Russian',
    languageEn: 'English',
    languageHint: 'UI and spoken answers',
    theme: 'Theme',
    themeLeo: 'LEO dark',
    themeHume: 'Hume light',
    speech: 'Voice replies',
    speechHint: 'LEO reads answers aloud in chat',
    ttsLanguage: 'Speech language',
    ttsLanguageRu: 'Russian',
    ttsLanguageEn: 'English',
    ttsVoice: 'Voice',
    myChats: 'My chats',
    myChatsShort: 'Chats',
    account: 'Profile',
    accountTitle: 'Profile',
    accountSubtitle: 'Sign-in and saved chats are tied to this email.',
    accountEmail: 'Email',
    accountMemberSince: 'Member since',
    accountAuthRequired: 'Sign in to open your account.',
    accountLoadError: 'Failed to load account data',
    logout: 'Log out',
    logoutTip: 'Sign out',
    chatTitle: 'Chat with LEO',
    newChat: 'New chat',
    muteOn: 'Unmute',
    muteOff: 'Mute',
    connecting: 'Connecting to LEO...',
    connectingLeo: 'Connecting to Leo...',
    inputPlaceholder: 'Type your reply…',
    inputListening: 'Listening...',
    inputSending: 'LEO is thinking…',
    send: 'Send',
    profile: 'Profile',
    prep: 'Prep',
    sidebarEmpty: 'Messages will appear here as you chat',
    editProfile: 'Profile',
    tabChat: 'Chat',
    tabVacancies: 'Jobs',
    tabMobileStage: 'Scenario',
    tabMobileWorkspace: 'Dialogue',
    mobileMainTabsAria: 'Scenario and dialogue',
    dialogueHistory: 'Dialogue history',
    sidebarSectionsAria: 'Sidebar sections',
    edit: 'Edit',
    editProfileModal: 'Edit profile',
    save: 'Save',
    cancel: 'Cancel',
    logoutConfirmTitle: 'Sign out',
    logoutConfirmContent: 'Are you sure you want to sign out?',
    logoutSuccess: 'You have signed out',
    profileEmptyJack:
      'No saved answers yet — continue the chat on the left; fields will appear here as you fill out the form.',
    formMessageRequired: 'Enter a message for LEO',
    prepHistoryGeneral: 'General',
    chatsSubtitle: 'Open a chat to continue or start a new one',
    chatsEmpty: 'No chats yet. Start a new one to begin.',
    chatsStartNew: 'Start new chat',
    chatsNewDialog: 'New conversation',
    chatsBackHome: 'Back to home',
    chatsDeleteTitle: 'Delete chat?',
    chatsDeleteOk: 'Delete',
    chatsDeleteCancel: 'Cancel',
    chatsDeleted: 'Chat deleted',
    chatsAuthRequired: 'Sign in to view your chats.',
    chatsLoadError: 'Failed to load chats',
    chatsDeleteError: 'Failed to delete chat',
  },
} as const;

export type ChatUiCopyKey = keyof typeof copy.ru;

export function chatUi(locale: AppLocale, key: ChatUiCopyKey): string {
  return copy[locale][key];
}

export function formatChatRelativeTime(locale: AppLocale, dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return locale === 'en' ? 'Just now' : 'Только что';
  }
  if (diffMins < 60) {
    return locale === 'en' ? `${diffMins} min ago` : `${diffMins} мин назад`;
  }
  if (diffHours < 24) {
    return locale === 'en' ? `${diffHours} h ago` : `${diffHours} ч назад`;
  }
  if (diffDays < 7) {
    return locale === 'en' ? `${diffDays} d ago` : `${diffDays} дн назад`;
  }

  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function chatsDeleteContent(locale: AppLocale, title: string): string {
  return locale === 'en'
    ? `Are you sure you want to delete “${title}”? This cannot be undone.`
    : `Вы уверены, что хотите удалить чат «${title}»? Это действие нельзя отменить.`;
}

export function positionsLabel(locale: AppLocale, count: number): string {
  if (locale === 'en') {
    return count === 1 ? `${count} role` : `${count} roles`;
  }
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${count} позиций`;
  if (n1 === 1) return `${count} позиция`;
  if (n1 >= 2 && n1 <= 4) return `${count} позиции`;
  return `${count} позиций`;
}

export function newJobsBadgeWord(locale: AppLocale, count: number): string {
  if (locale === 'en') {
    return count === 1 ? 'new' : 'new';
  }
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'новых';
  if (n1 === 1) return 'новая';
  if (n1 >= 2 && n1 <= 4) return 'новые';
  return 'новых';
}

export function inRecommendedSummary(locale: AppLocale, count: number): string {
  if (locale === 'en') {
    return `${positionsLabel(locale, count)} in Recommended`;
  }
  return `${positionsLabel(locale, count)} в «Рекомендуем»`;
}

export function weakMatchSummary(locale: AppLocale, count: number): string {
  return locale === 'en'
    ? `${count} weak match${count === 1 ? '' : 'es'}`
    : `${count} со слабым совпадением`;
}
