/**
 * LEO Med TG ingest — channels from med_sources.json only (never Jack IT catalog).
 */

import axios from 'axios';
import { logger } from '../../utils/logger';
import { guessWorkMode, keywordMatches, mapToJobInput, stripHtml } from '../connectors/mapJob';
import { cleanJobTitle, guessOrgFromTitle } from '../connectors/normalizeJobCard';
import { getTgAxiosProxyConfig } from '../connectors/tgHttpProxy';
import { getScraperUserAgent } from '../connectors/config';
import type { JobInput } from '../../models/job';
import { listMedSources } from './catalog';

const MSG_SPLIT = 'tgme_widget_message_wrap';
const PERMALINK_RE = /href="(https:\/\/t\.me\/([^/"?]+)\/(\d+))"/;
const TEXT_RE = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
const HREF_RE = /href="(https?:\/\/[^"]+)"/gi;

const POSTS_PER_CHANNEL = 25;
const DEFAULT_TG_MAX_JOBS = 200;

function firstLineTitle(text: string): string {
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/^[·—\-|]+/, '').trim();
    if (trimmed.length >= 8) return trimmed.slice(0, 280);
  }
  return text.slice(0, 200) || 'Вакансия из Telegram';
}

function externalJobUrl(text: string, html: string): string | null {
  const candidates: string[] = [];
  HREF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HREF_RE.exec(html)) !== null) {
    const url = m[1].replace(/&amp;/g, '&');
    const low = url.toLowerCase();
    if (low.includes('t.me/') || low.includes('telegram.org')) continue;
    candidates.push(url);
  }
  for (const match of text.match(/https?:\/\/[^\s)\]>"']+/g) || []) {
    const url = match.replace(/[.,;]+$/, '');
    if (url.toLowerCase().includes('t.me/')) continue;
    if (!candidates.includes(url)) candidates.push(url);
  }
  return candidates[0] || null;
}

function parseChannelHtml(
  html: string,
  username: string,
  channelTitle: string,
  keywords: string[],
  limit: number
): JobInput[] {
  const jobs: JobInput[] = [];
  const parts = html.split(MSG_SPLIT).slice(1);
  for (const block of parts) {
    if (jobs.length >= limit) break;
    const pm = PERMALINK_RE.exec(block);
    if (!pm) continue;
    const permalink = pm[1];
    const tm = TEXT_RE.exec(block);
    if (!tm) continue;
    const text = stripHtml(tm[1].replace(/<br\s*\/?>/gi, '\n'));
    if (text.length < 20) continue;
    if (!keywordMatches(text, keywords)) continue;

    const rawTitle = firstLineTitle(text);
    const company =
      guessOrgFromTitle(rawTitle, null) ||
      (channelTitle && channelTitle !== username ? channelTitle : null) ||
      'Telegram';
    const title = cleanJobTitle(rawTitle, company);
    const jobUrl = externalJobUrl(text, block) || permalink;
    jobs.push(
      mapToJobInput({
        title,
        company,
        source: `tg_${username.toLowerCase()}`,
        source_url: jobUrl,
        description: text.slice(0, 2500),
        work_mode: guessWorkMode(text),
      })
    );
  }
  return jobs;
}

/** Active TG channels for Med (full registry when status=active). */
export function listActiveMedTgChannels(): Array<{ username: string; title: string }> {
  return listMedSources({ type: 'tg', status: 'active' })
    .filter((s) => s.username)
    .map((s) => ({
      username: String(s.username).replace(/^@/, ''),
      title: s.title,
    }));
}

export async function fetchMedTelegramJobs(
  keywords: string[],
  maxJobs = DEFAULT_TG_MAX_JOBS
): Promise<JobInput[]> {
  const channels = listActiveMedTgChannels();
  if (channels.length === 0) {
    logger.info('Med TG: no active channels in registry');
    return [];
  }

  const userAgent = getScraperUserAgent();
  const jobs: JobInput[] = [];
  const seen = new Set<string>();

  for (const ch of channels) {
    if (jobs.length >= maxJobs) break;
    const url = `https://t.me/s/${ch.username}`;
    try {
      const resp = await axios.get<string>(url, {
        timeout: 15000,
        headers: { 'User-Agent': userAgent },
        responseType: 'text',
        validateStatus: (s) => s < 500,
        ...getTgAxiosProxyConfig(),
      });
      if (resp.status !== 200) {
        logger.warn(`Med TG ${ch.username} → HTTP ${resp.status}`);
        continue;
      }
      const found = parseChannelHtml(
        resp.data,
        ch.username,
        ch.title,
        keywords,
        Math.min(POSTS_PER_CHANNEL, maxJobs - jobs.length)
      );
      for (const job of found) {
        if (seen.has(job.source_url)) continue;
        seen.add(job.source_url);
        jobs.push(job);
        if (jobs.length >= maxJobs) break;
      }
      logger.info(`Med tg_${ch.username}: ${found.length} posts kept`);
    } catch (error: unknown) {
      logger.warn(
        `Med TG ${ch.username} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return jobs;
}
