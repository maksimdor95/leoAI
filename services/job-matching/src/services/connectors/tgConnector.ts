/**
 * Public Telegram job channels via https://t.me/s/<username>.
 * Spec: docs/JOB_SOURCES_EXPANSION.md (wave B)
 */

import axios from 'axios';
import catalog from '../data/tg_job_channels.json';
import { logger } from '../../utils/logger';
import { guessWorkMode, keywordMatches, mapToJobInput, stripHtml } from './mapJob';
import { cleanJobTitle, guessOrgFromTitle } from './normalizeJobCard';
import { getTgAxiosProxyConfig } from './tgHttpProxy';
import type { ConnectorFetchParams, ConnectorFetchResult, JobConnector } from './types';

const MSG_SPLIT = 'tgme_widget_message_wrap';
const PERMALINK_RE = /href="(https:\/\/t\.me\/([^/"?]+)\/(\d+))"/;
const TEXT_RE = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
const HREF_RE = /href="(https?:\/\/[^"]+)"/gi;

interface TgChannel {
  username?: string;
  title?: string;
  families?: string[];
  priority?: string;
}

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
    if (['linkedin.com', 'instagram.com', 'vk.com/wall'].some((x) => low.includes(x))) {
      continue;
    }
    candidates.push(url);
  }
  for (const match of text.match(/https?:\/\/[^\s)\]>"']+/g) || []) {
    const url = match.replace(/[.,;]+$/, '');
    const low = url.toLowerCase();
    if (low.includes('t.me/') || low.includes('linkedin.com')) continue;
    if (!candidates.includes(url)) candidates.push(url);
  }
  return candidates[0] || null;
}

function parseChannelHtml(
  html: string,
  channel: TgChannel,
  keywords: string[],
  limit: number
) {
  const username = (channel.username || '').trim();
  const channelTitle = (channel.title || '').trim() || username;
  const jobs = [];
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

export const tgConnector: JobConnector = {
  id: 'tg',
  jobSource: 'tg_jobs',

  async fetch(params: ConnectorFetchParams): Promise<ConnectorFetchResult> {
    const channels = (catalog.channels || []) as TgChannel[];
    const postsPerChannel = Number(catalog.posts_per_channel) || 25;
    const jobs = [];
    const seen = new Set<string>();

    for (const ch of channels) {
      if (jobs.length >= params.maxJobs) break;
      const username = String(ch.username || '')
        .trim()
        .replace(/^@/, '');
      if (!username) continue;

      const url = `https://t.me/s/${username}`;
      try {
        const resp = await axios.get<string>(url, {
          timeout: 15000,
          headers: { 'User-Agent': params.userAgent },
          responseType: 'text',
          validateStatus: (s) => s < 500,
          ...getTgAxiosProxyConfig(),
        });
        if (resp.status !== 200) {
          logger.warn(`tg channel ${username} → HTTP ${resp.status}`);
          continue;
        }
        const found = parseChannelHtml(
          resp.data,
          { ...ch, username },
          params.keywords,
          Math.min(postsPerChannel, params.maxJobs - jobs.length)
        );
        for (const job of found) {
          if (seen.has(job.source_url)) continue;
          seen.add(job.source_url);
          jobs.push(job);
          if (jobs.length >= params.maxJobs) break;
        }
        logger.info(`tg_${username}: ${found.length} posts kept`);
      } catch (error: unknown) {
        logger.warn(
          `tg channel ${username} failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return {
      sourceId: 'tg',
      sourcesUsedLabel: 'tg-jobs',
      jobs,
    };
  },
};
