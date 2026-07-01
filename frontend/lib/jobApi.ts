import { isAuthenticated } from '@/lib/auth';
import { getPublicJobMatchingBaseUrl } from '@/lib/publicJobMatchingUrl';
import { getPublicConversationBaseUrl } from '@/lib/publicApiBaseUrl';
import type {
  ApplicationDraftRequest,
  ApplicationDraftResponse,
  JobDetailsResponse,
  JobInteractionType,
} from '@/types/jobs';

const jobsBaseUrl = () => getPublicJobMatchingBaseUrl();
const conversationBaseUrl = () => getPublicConversationBaseUrl();

export async function fetchJobDetails(
  jobId: string,
  options?: { refresh?: boolean }
): Promise<JobDetailsResponse> {
  if (!isAuthenticated()) {
    throw new Error('Unauthorized');
  }

  const query = options?.refresh ? '?refresh=1' : '';
  const response = await fetch(`${jobsBaseUrl()}/api/jobs/${jobId}${query}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load job');
  }

  return response.json() as Promise<JobDetailsResponse>;
}

export async function recordJobInteraction(
  jobId: string,
  interactionType: JobInteractionType
): Promise<void> {
  if (!isAuthenticated()) {
    return;
  }

  await fetch(`${jobsBaseUrl()}/api/jobs/interaction`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId, interactionType }),
  }).catch(() => {
    // telemetry is best-effort
  });
}

export async function generateApplicationDraft(
  jobId: string,
  body: ApplicationDraftRequest
): Promise<ApplicationDraftResponse> {
  if (!isAuthenticated()) {
    throw new Error('Unauthorized');
  }

  const response = await fetch(`${conversationBaseUrl()}/api/jobs/${jobId}/application-draft`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : typeof data?.error === 'string'
          ? data.error
          : 'Не удалось подготовить отклик';
    throw new Error(message);
  }

  return data as ApplicationDraftResponse;
}
