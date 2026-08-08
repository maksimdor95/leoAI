/**
 * HH.ru vacancy probe (Phase 0 — same behavior as legacy hhRevalidate).
 */

import axios, { isAxiosError } from 'axios';
import type { Job } from '../../models/job';
import { extractExternalVacancyId } from '../../utils/vacancyUrl';
import { fetchHhVacancyDetails } from '../scraper';
import type { VacancyProbeResult, VacancyRevalidator } from './types';

const HH_API_URL = process.env.HH_API_URL || 'https://api.hh.ru';

function buildHHApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':
      process.env.HH_USER_AGENT ||
      'LeoAI-JobMatching/1.0 (+https://leo-ai.ru; vacancy-revalidate)',
    Accept: 'application/json',
  };
  const token = process.env.HH_API_KEY || process.env.HH_ACCESS_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Probe by HH vacancy id (used by job details refresh). */
export async function probeHhVacancyStatus(hhVacancyId: string): Promise<VacancyProbeResult> {
  try {
    const response = await axios.get(`${HH_API_URL}/vacancies/${hhVacancyId}`, {
      headers: buildHHApiHeaders(),
      timeout: 8000,
      validateStatus: (s) => s < 500,
    });
    if (response.status === 404 || response.status === 410) {
      return { status: 'gone', reason: 'not_found' };
    }
    if (response.status !== 200) {
      return { status: 'error', message: `HTTP ${response.status}` };
    }
    const data = response.data as { archived?: boolean };
    if (data?.archived === true) {
      return { status: 'gone', reason: 'archived' };
    }
    const fresh = await fetchHhVacancyDetails(hhVacancyId);
    if (fresh) {
      return { status: 'live', fresh };
    }
    return { status: 'error', message: 'detail fetch failed after live probe' };
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

export const hhRevalidator: VacancyRevalidator = {
  id: 'hh',
  sources: ['hh.ru'],
  async probe(job: Job): Promise<VacancyProbeResult> {
    const hhId = extractExternalVacancyId(job.source, job.source_url);
    if (!hhId) {
      return { status: 'skip', message: 'no hh vacancy id' };
    }
    return probeHhVacancyStatus(hhId);
  },
};
