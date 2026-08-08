/**
 * SuperJob vacancy probe via API GET /vacancies/{id}/.
 */

import axios, { isAxiosError } from 'axios';
import type { Job } from '../../models/job';
import { fetchSuperJobVacancyDetails } from '../scraper';
import type { VacancyProbeResult, VacancyRevalidator } from './types';

const SUPERJOB_API_URL = process.env.SUPERJOB_API_URL || 'https://api.superjob.ru/2.0';

export function extractSuperJobVacancyId(sourceUrl: string): string | null {
  const raw = sourceUrl?.trim() || '';
  if (!raw) return null;
  const m =
    raw.match(/\/vakansii\/(\d+)/i) ||
    raw.match(/[?&]id=(\d+)/i) ||
    raw.match(/superjob\.ru\/.*?(\d{5,})/i);
  return m?.[1] ?? null;
}

function sjHeaders(): Record<string, string> {
  const apiKey = process.env.SUPERJOB_API_KEY || '';
  const headers: Record<string, string> = {
    'User-Agent':
      process.env.SCRAPER_USER_AGENT ||
      'LeoAI-JobMatching/1.0 (+https://leo-ai.ru; vacancy-revalidate)',
    Accept: 'application/json',
  };
  if (apiKey) {
    headers['X-Api-App-Id'] = apiKey;
  }
  if (process.env.SUPERJOB_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.SUPERJOB_ACCESS_TOKEN}`;
  }
  return headers;
}

export async function probeSuperJobVacancyStatus(sjId: string): Promise<VacancyProbeResult> {
  if (!process.env.SUPERJOB_API_KEY) {
    return { status: 'skip', message: 'SUPERJOB_API_KEY not set' };
  }

  try {
    const response = await axios.get(`${SUPERJOB_API_URL}/vacancies/${sjId}/`, {
      headers: sjHeaders(),
      timeout: 10000,
      validateStatus: (s) => s < 500,
    });
    if (response.status === 404 || response.status === 410) {
      return { status: 'gone', reason: 'not_found' };
    }
    if (response.status !== 200) {
      return { status: 'error', message: `HTTP ${response.status}` };
    }
    const data = response.data as Record<string, unknown>;
    // SuperJob may mark inactive vacancies
    if (data?.is_closed === true || data?.active === false) {
      return { status: 'gone', reason: 'archived' };
    }
    const fresh = await fetchSuperJobVacancyDetails(sjId);
    if (fresh) {
      return { status: 'live', fresh };
    }
    // API said 200 — treat as live even if parse failed; orchestrator can touch
    return { status: 'live' };
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      const code = error.response?.status;
      if (code === 404 || code === 410) {
        return { status: 'gone', reason: 'not_found' };
      }
      return {
        status: 'error',
        message: error.message || `axios ${code ?? 'network'}`,
      };
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export const superjobRevalidator: VacancyRevalidator = {
  id: 'superjob',
  sources: ['superjob.ru'],
  async probe(job: Job): Promise<VacancyProbeResult> {
    if (!process.env.SUPERJOB_API_KEY) {
      return { status: 'skip', message: 'SUPERJOB_API_KEY not set' };
    }
    const sjId = extractSuperJobVacancyId(job.source_url);
    if (!sjId) {
      return { status: 'skip', message: 'no superjob vacancy id' };
    }
    return probeSuperJobVacancyStatus(sjId);
  },
};
