import { config } from './config';

export function welcomeText(startParam?: string, linkedAccount?: boolean): string {
  const sourceLabel = startParam ? formatSourceLabel(startParam) : undefined;
  const sourceLine = sourceLabel ? `\n\n<i>Источник:</i> ${escapeHtml(sourceLabel)}` : '';
  const linkedLine = linkedAccount
    ? '\n\n✅ Ваш Telegram привязан к аккаунту на сайте — в обращении будет виден ваш ID.'
    : '';
  return (
    `Здравствуйте! Это поддержка <b>LEO AI</b>.\n\n` +
    `Опишите вопрос одним сообщением: аккаунт, вакансии, подготовка к интервью, ошибка на сайте.\n\n` +
    `Не отправляйте пароли, токены и платёжные данные.\n` +
    `<a href="${config.siteUrl}/privacy">Политика конфиденциальности</a>` +
    sourceLine +
    linkedLine
  );
}

export function helpText(): string {
  return (
    `<b>Команды</b>\n` +
    `/start — начать обращение\n` +
    `/help — эта справка\n` +
    `/privacy — политика конфиденциальности\n\n` +
    `Напишите текст, фото или файл — мы передадим обращение в поддержку и ответим здесь в Telegram.`
  );
}

export function privacyText(): string {
  return `<a href="${config.siteUrl}/privacy">Политика конфиденциальности LEO AI</a>`;
}

export function receivedAckText(): string {
  return 'Спасибо! Обращение передано в поддержку. Мы ответим вам здесь в Telegram.';
}

const SOURCE_LABELS: Record<string, string> = {
  support_site: 'кнопка на сайте',
  privacy: 'политика конфиденциальности',
  terms: 'условия использования',
};

function formatSourceLabel(source?: string): string | undefined {
  if (!source) return undefined;
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  if (source.startsWith('u_')) return 'вход с сайта (авторизован)';
  return source;
}

export function formatTicketHeader(
  ticketNo: number,
  displayName: string,
  username: string | undefined,
  userId: number,
  source?: string,
  siteUserId?: string
): string {
  const userLine = username
    ? `${escapeHtml(displayName)} (@${escapeHtml(username)})`
    : escapeHtml(displayName);
  const sourceLabel = formatSourceLabel(source);
  const sourceLine = sourceLabel ? `\n<i>Источник:</i> ${escapeHtml(sourceLabel)}` : '';
  const siteLine = siteUserId
    ? `\n🌐 <b>Аккаунт LEO AI:</b> <code>${escapeHtml(siteUserId)}</code>`
    : '';
  return (
    `🆕 <b>Обращение #${ticketNo}</b>\n` +
    `От: ${userLine}\n` +
    `ID: <code>${userId}</code>${siteLine}${sourceLine}\n\n` +
    `<i>Ответьте reply на это сообщение, чтобы ответ ушёл пользователю.</i>`
  );
}

export function operatorHintNoTicket(): string {
  return 'Не найдено обращение для этого reply. Ответьте на карточку обращения от бота.';
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function displayName(from: {
  first_name?: string;
  last_name?: string;
  username?: string;
}): string {
  const parts = [from.first_name, from.last_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  if (from.username) return `@${from.username}`;
  return 'Пользователь';
}
