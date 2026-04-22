/**
 * Загрузка резюме на user-profile, извлечение полей через ai-nlp.
 */

import { getToken } from './auth';
import { buildAuthHeaders } from './authHeaders';

const getUserProfileBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const getAiBaseUrl = () =>
  process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:3003';

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

export async function uploadResumeFile(
  file: File,
  options?: { trackId?: string }
): Promise<UploadResumeResponse> {
  const token = getToken();
  if (!token) {
    throw new Error('Нужна авторизация');
  }
  const fd = new FormData();
  fd.append('file', file);
  if (options?.trackId) {
    fd.append('track_id', options.trackId);
  }
  const res = await fetch(`${getUserProfileBaseUrl()}/api/career/resumes/upload`, {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(token),
    },
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
  const token = getToken();
  if (!token) {
    throw new Error('Нужна авторизация');
  }
  const res = await fetch(`${getAiBaseUrl()}/api/ai/extract-profile-from-resume`, {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(token, true),
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
  const token = getToken();
  if (!token) {
    throw new Error('Нужна авторизация');
  }
  const q = trackId ? `?track_id=${encodeURIComponent(trackId)}` : '';
  const res = await fetch(`${getUserProfileBaseUrl()}/api/career/resumes${q}`, {
    headers: buildAuthHeaders(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return (data as { resumes: UploadResumeResponse['resume'][] }).resumes;
}

export async function deleteResume(resumeId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error('Нужна авторизация');
  }
  const res = await fetch(`${getUserProfileBaseUrl()}/api/career/resumes/${resumeId}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
}
