/**
 * Ensures background enrichment never full-replaces the Redis session
 * (that race wiped desired_salary / currentStepId during «Уточнить пустые поля»).
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    setEx: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sAdd: jest.fn(),
    sMembers: jest.fn(),
  },
}));

const mockGetSession = jest.fn();
const mockUpdateSessionMetadata = jest.fn();

jest.mock('../sessionService', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  updateSessionMetadata: (...args: unknown[]) => mockUpdateSessionMetadata(...args),
  updateSession: jest.fn(),
}));

jest.mock('axios');

import axios from 'axios';
import { enrichAndPersistProfile } from '../profileEnrichmentService';
import type { ConversationSession } from '../../types/session';
import { ENRICHED_COLLECTED_KEY } from '../../types/enrichedProfile';

const mockedAxios = axios as jest.Mocked<typeof axios>;

function baseSession(overrides?: Partial<ConversationSession>): ConversationSession {
  return {
    id: 'sess-1',
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [],
    metadata: {
      collectedData: {
        desired_role: 'PM',
        scenarioMode: 'готовое резюме',
      },
      status: 'active',
      product: 'jack',
      scenarioId: 'jack-profile-v2',
      completedSteps: ['resume_ready'],
      currentStepId: 'desired_salary',
      flags: { fillProfileGaps: true },
    },
    ...overrides,
  };
}

describe('enrichAndPersistProfile race safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: {} });
    mockedAxios.post.mockImplementation(async (url: string) => {
      if (String(url).includes('derive-profile-signals')) {
        return { data: { signals: { role_family: 'product' } } };
      }
      if (String(url).includes('enrich-profile')) {
        return {
          data: {
            enriched: {
              version: 1,
              enrichedAt: '2026-01-01T00:00:00.000Z',
              source: 'resume_import',
              role_family: 'product',
              profile_completeness: 0.75,
            },
          },
        };
      }
      if (String(url).includes('/api/career/profile')) {
        return { data: {} };
      }
      return { data: {} };
    });
    mockedAxios.put.mockResolvedValue({ data: {} });
  });

  it('merges only __enriched into Redis and preserves concurrent gap answers', async () => {
    const stale = baseSession();
    // Concurrent reply already saved salary + advanced step while LLM was running.
    const liveAfterGaps = baseSession({
      metadata: {
        ...stale.metadata,
        collectedData: {
          ...stale.metadata.collectedData,
          desired_salary: '500 000 рублей',
          desired_culture: 'культура, технологии',
        },
        currentStepId: 'desired_culture',
        flags: { fillProfileGaps: true },
      },
    });

    mockGetSession
      .mockResolvedValueOnce(liveAfterGaps) // after LLM: merge base
      .mockResolvedValueOnce(liveAfterGaps); // after metadata patch: persist fields
    mockUpdateSessionMetadata.mockResolvedValue(undefined);

    // Career track resolve
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/career/tracks')) {
        return { data: { tracks: [{ id: 'track-1', is_default: true }] } };
      }
      return { data: {} };
    });

    const result = await enrichAndPersistProfile(stale, 'token', 'merge_collected');
    expect(result).not.toBeNull();

    expect(mockUpdateSessionMetadata).toHaveBeenCalledWith('sess-1', {
      collectedData: {
        [ENRICHED_COLLECTED_KEY]: expect.objectContaining({
          role_family: 'product',
        }),
      },
    });

    // Must not wipe salary when persisting career profile
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/profile-data'),
      expect.objectContaining({
        profile_data: expect.objectContaining({
          fields: expect.objectContaining({
            desired_salary: '500 000 рублей',
            desired_culture: 'культура, технологии',
          }),
        }),
      }),
      expect.any(Object)
    );

    // In-memory stale snapshot must not become the Redis write payload for step/flags
    expect(mockUpdateSessionMetadata.mock.calls[0][1]).not.toHaveProperty('currentStepId');
    expect(mockUpdateSessionMetadata.mock.calls[0][1]).not.toHaveProperty('flags');
  });
});
