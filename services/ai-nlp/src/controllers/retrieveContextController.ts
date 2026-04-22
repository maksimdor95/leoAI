import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';

const chunkSchema = z.object({
  chunkId: z.string(),
  type: z.literal('text'),
  text: z.string(),
  page: z.number().optional(),
  section: z.string().optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.number().optional(),
  lang: z.enum(['ru', 'en', 'unknown']).optional(),
});

const bodySchema = z.object({
  sessionId: z.string().min(1).optional(),
  scenarioId: z.string().min(1).optional(),
  query: z.string().min(3),
  topK: z.number().int().min(1).max(20).optional(),
  collectedData: z.record(z.string(), z.unknown()).optional(),
  contentList: z
    .object({
      docId: z.string().optional(),
      chunks: z.array(chunkSchema),
    })
    .optional(),
});

type RetrievalItem = {
  chunkId: string;
  text: string;
  score: number;
  reason: string;
  metadata: {
    docId?: string;
    page?: number;
    tags?: string[];
    source: 'content_list' | 'collected_data';
  };
};

function normalizeText(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function scoreMatch(queryTokens: string[], text: string, tags: string[]): { score: number; reason: string } {
  const textTokens = normalizeText(text);
  const tokenSet = new Set(textTokens);
  const overlap = queryTokens.filter((t) => tokenSet.has(t));
  const tagOverlap = queryTokens.filter((t) => tags.some((tag) => tag.toLowerCase().includes(t)));
  const overlapScore = overlap.length / Math.max(1, queryTokens.length);
  const tagScore = tagOverlap.length > 0 ? Math.min(0.3, tagOverlap.length * 0.1) : 0;
  const lengthPenalty = text.length > 900 ? 0.9 : 1;
  const score = Number(((overlapScore + tagScore) * lengthPenalty).toFixed(4));
  return {
    score,
    reason:
      overlap.length > 0
        ? `matched: ${overlap.slice(0, 4).join(', ')}`
        : tagOverlap.length > 0
          ? `matched tags: ${tagOverlap.slice(0, 3).join(', ')}`
          : 'weak lexical overlap',
  };
}

function collectedDataToItems(collectedData: Record<string, unknown>): Array<{ chunkId: string; text: string; tags: string[] }> {
  const items: Array<{ chunkId: string; text: string; tags: string[] }> = [];
  for (const [key, value] of Object.entries(collectedData)) {
    if (value === null || value === undefined) continue;
    const text = typeof value === 'string' ? value : Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
    if (!text || text.length < 8) continue;
    items.push({
      chunkId: `cd_${key}`,
      text: `${key}: ${text}`,
      tags: [key],
    });
  }
  return items;
}

export async function retrieveContext(req: Request, res: Response) {
  try {
    const parsed = bodySchema.parse(req.body);
    const topK = parsed.topK ?? 5;
    const queryTokens = normalizeText(parsed.query);

    const candidates: RetrievalItem[] = [];

    if (parsed.contentList?.chunks?.length) {
      for (const chunk of parsed.contentList.chunks) {
        const { score, reason } = scoreMatch(queryTokens, chunk.text, chunk.tags || []);
        if (score <= 0) continue;
        candidates.push({
          chunkId: chunk.chunkId,
          text: chunk.text,
          score,
          reason,
          metadata: {
            docId: parsed.contentList.docId,
            page: chunk.page,
            tags: chunk.tags,
            source: 'content_list',
          },
        });
      }
    }

    if ((!parsed.contentList || parsed.contentList.chunks.length === 0) && parsed.collectedData) {
      const collectedItems = collectedDataToItems(parsed.collectedData);
      for (const item of collectedItems) {
        const { score, reason } = scoreMatch(queryTokens, item.text, item.tags);
        if (score <= 0) continue;
        candidates.push({
          chunkId: item.chunkId,
          text: item.text,
          score,
          reason,
          metadata: {
            tags: item.tags,
            source: 'collected_data',
          },
        });
      }
    }

    const items = candidates.sort((a, b) => b.score - a.score).slice(0, topK);

    res.json({
      status: 'success',
      items,
      debug: {
        queryNorm: queryTokens.join(' '),
        retrievalMode: parsed.contentList?.chunks?.length ? 'content-list' : 'collected-data',
      },
    });
  } catch (error: unknown) {
    logger.error('retrieveContext failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve context';
    res.status(400).json({ status: 'error', message });
  }
}

