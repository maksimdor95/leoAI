/**
 * LEO Med — профиль, собранный в чате (ветка med_* Jack-сценария).
 * Маркеры приходят в collectedData сессии из conversation-сервиса.
 */

import { MED_UNKNOWN_ROLE_ID } from './mapRole';

/**
 * Медицинская роль кандидата или null, если он не на Med-ветке
 * (не распознан либо явно ответил «нет» на подтверждение).
 */
export function resolveMedRoleIdFromCollected(
  collected: Record<string, unknown> | null | undefined
): string | null {
  if (!collected) return null;

  const raw = typeof collected.medRoleId === 'string' ? collected.medRoleId.trim() : '';
  if (!raw || raw === MED_UNKNOWN_ROLE_ID) return null;

  const confirmed = String(collected.medConfirmed ?? '')
    .toLowerCase()
    .trim();
  if (confirmed && confirmed !== 'да') return null;

  return raw;
}
