import { getPublicEmailBaseUrl } from './publicApiBaseUrl';

export interface ConsultationLead {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  message: string;
  consent: boolean;
  source?: string;
}

/**
 * Отправка заявки на консультацию («Написать нам»).
 * Уходит в email-сервис (POST /api/email/send-consultation), который пересылает заявку команде LEO.
 */
export async function submitConsultationLead(lead: ConsultationLead): Promise<void> {
  const baseUrl = getPublicEmailBaseUrl();
  const sourceUrl =
    typeof window !== 'undefined' ? window.location.href : undefined;

  const response = await fetch(`${baseUrl}/api/email/send-consultation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: lead.name?.trim() || undefined,
      email: lead.email?.trim() || undefined,
      phone: lead.phone?.trim() || undefined,
      service: lead.service?.trim() || undefined,
      message: lead.message.trim(),
      consent: lead.consent,
      source: lead.source || 'chat-support-widget',
      sourceUrl,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Не удалось отправить заявку (HTTP ${response.status})`);
  }
}
