/**
 * Загрузка резюме на user-profile, извлечение полей через ai-nlp.
 */

import { isAuthenticated } from './auth';
import { getPublicAiBaseUrl, getPublicApiBaseUrl } from './publicApiBaseUrl';

const getUserProfileBaseUrl = () => getPublicApiBaseUrl();

const getAiBaseUrl = () => getPublicAiBaseUrl();

export type UploadResumeResponse = {
  resume: {
    id: string;
    user_id: string;
    track_id: string;
    resume_text: string;
    original_filename: string | null;
    mime_type: string | null;
    storage_path: string | null;
    created_at: string;
  };
  extractedText: string;
  docId?: string;
  chunksCount?: number;
  contentList?: {
    docId: string;
    userId: string;
    sourceType: 'resume';
    sourceName: string;
    version: 1;
    chunks: Array<{
      chunkId: string;
      type: 'text';
      text: string;
      page: number;
      section: string;
      tags: string[];
      confidence: number;
      lang: 'ru' | 'en' | 'unknown';
    }>;
  } | null;
};

function assertAuth(): void {
  if (!isAuthenticated()) {
    throw new Error('Нужна авторизация');
  }
}

export async function uploadResumeFile(
  file: File,
  options?: { trackId?: string }
): Promise<UploadResumeResponse> {
  assertAuth();
  const fd = new FormData();
  fd.append('file', file);
  if (options?.trackId) {
    fd.append('track_id', options.trackId);
  }
  const res = await fetch(`${getUserProfileBaseUrl()}/api/career/resumes/upload`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Ошибка загрузки: HTTP ${res.status}`);
  }
  return data as UploadResumeResponse;
}

export async function extractProfileFromResumeText(
  resumeText: string,
  scenarioId: string
): Promise<{ fields: Record<string, unknown>; notes?: string }> {
  assertAuth();
  const res = await fetch(`${getAiBaseUrl()}/api/ai/extract-profile-from-resume`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resumeText, scenarioId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Ошибка разбора резюме: HTTP ${res.status}`);
  }
  const fields = (data as { fields?: Record<string, unknown> }).fields;
  if (!fields || typeof fields !== 'object') {
    throw new Error('Сервис не вернул поля профиля');
  }
  return {
    fields,
    notes: (data as { notes?: string }).notes,
  };
}

export async function listResumes(trackId?: string): Promise<UploadResumeResponse['resume'][]> {
  assertAuth();
  const q = trackId ? `?track_id=${encodeURIComponent(trackId)}` : '';
  const res = await fetch(`${getUserProfileBaseUrl()}/api/career/resumes${q}`, {
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return (data as { resumes: UploadResumeResponse['resume'][] }).resumes;
}

export async function deleteResume(resumeId: string): Promise<void> {
  assertAuth();
  const res = await fetch(`${getUserProfileBaseUrl()}/api/career/resumes/${resumeId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
}
