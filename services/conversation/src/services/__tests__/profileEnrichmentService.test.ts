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

    // Career track resolve — sole generic track is reused + renamed for this role
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/career/tracks')) {
        return { data: { tracks: [{ id: 'track-1', is_default: true, name: 'Основной' }] } };
      }
      return { data: {} };
    });
    mockedAxios.patch.mockResolvedValue({ data: { track: { id: 'track-1' } } });

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

    // Session linked to the career track (persona)
    expect(mockUpdateSessionMetadata).toHaveBeenCalledWith('sess-1', {
      collectedData: { career_track_id: 'track-1' },
    });

    // In-memory stale snapshot must not become the Redis write payload for step/flags
    expect(mockUpdateSessionMetadata.mock.calls[0][1]).not.toHaveProperty('currentStepId');
    expect(mockUpdateSessionMetadata.mock.calls[0][1]).not.toHaveProperty('flags');
  });

  it('creates a new track when desired role differs from existing personas', async () => {
    const session = baseSession({
      metadata: {
        ...baseSession().metadata,
        collectedData: { desired_role: 'UX Researcher' },
      },
    });
    mockGetSession.mockResolvedValue(session);
    mockUpdateSessionMetadata.mockResolvedValue(undefined);

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/career/tracks')) {
        return {
          data: {
            tracks: [
              {
                id: 'track-product',
                is_default: true,
                name: 'Product',
                target_role: 'Head of Product',
              },
            ],
          },
        };
      }
      return { data: {} };
    });
    mockedAxios.post.mockImplementation(async (url: string, body?: unknown) => {
      if (String(url).includes('derive-profile-signals')) {
        return { data: { signals: { role_family: 'research' } } };
      }
      if (String(url).includes('enrich-profile')) {
        return {
          data: {
            enriched: {
              version: 1,
              enrichedAt: '2026-01-01T00:00:00.000Z',
              source: 'jack-profile-v2',
              role_family: 'research',
              job_preferences: { target_role: 'UX Researcher' },
              profile_completeness: 0.5,
            },
          },
        };
      }
      if (String(url).endsWith('/api/career/tracks')) {
        expect(body).toEqual(
          expect.objectContaining({
            name: 'Research',
            target_role: 'UX Researcher',
            is_default: false,
          })
        );
        return { data: { track: { id: 'track-research' } } };
      }
      if (String(url).includes('/api/career/profile')) {
        return { data: {} };
      }
      return { data: {} };
    });

    const result = await enrichAndPersistProfile(session, 'token', 'desired_start');
    expect(result).not.toBeNull();
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/tracks/track-research/profile-data'),
      expect.any(Object),
      expect.any(Object)
    );
    expect(mockUpdateSessionMetadata).toHaveBeenCalledWith('sess-1', {
      collectedData: { career_track_id: 'track-research' },
    });
  });
});

describe('persistMedCareerTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: {} });
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.put.mockResolvedValue({ data: {} });
    mockedAxios.patch.mockResolvedValue({ data: {} });
    mockUpdateSessionMetadata.mockResolvedValue(undefined);
  });

  it('does not overwrite sole track that already has a target_role', async () => {
    const { persistMedCareerTrack } = await import('../profileEnrichmentService');
    const session = baseSession({
      metadata: {
        ...baseSession().metadata,
        collectedData: {
          medRoleId: 'doctor_therapist',
          medRoleTitle: 'Врач-терапевт',
          medSkillLabels: ['АД'],
        },
      },
    });

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/career/tracks')) {
        return {
          data: {
            tracks: [
              {
                id: 'track-product',
                is_default: true,
                name: 'Основной',
                target_role: 'Head of Product',
              },
            ],
          },
        };
      }
      return { data: {} };
    });
    mockedAxios.post.mockImplementation(async (url: string, body?: unknown) => {
      if (String(url).endsWith('/api/career/tracks')) {
        expect(body).toEqual(
          expect.objectContaining({
            target_role: 'Врач-терапевт',
            is_default: false,
          })
        );
        return { data: { track: { id: 'track-med-new' } } };
      }
      return { data: {} };
    });

    const trackId = await persistMedCareerTrack(session, 'token');
    expect(trackId).toBe('track-med-new');
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it('creates a medicine career track from med collectedData', async () => {
    const { persistMedCareerTrack } = await import('../profileEnrichmentService');
    const session = baseSession({
      metadata: {
        ...baseSession().metadata,
        collectedData: {
          medRoleId: 'doctor_therapist',
          medRoleTitle: 'Врач-терапевт',
          medSkillLabels: ['АД', 'ЭКГ'],
          desired_location: 'Москва',
          careerSummary: '10 лет в поликлинике',
        },
      },
    });

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/career/tracks')) {
        return {
          data: {
            tracks: [
              {
                id: 'track-product',
                is_default: true,
                name: 'Product',
                target_role: 'Head of Product',
              },
            ],
          },
        };
      }
      return { data: {} };
    });
    mockedAxios.post.mockImplementation(async (url: string, body?: unknown) => {
      if (String(url).endsWith('/api/career/tracks')) {
        expect(body).toEqual(
          expect.objectContaining({
            target_role: 'Врач-терапевт',
            is_default: false,
          })
        );
        return { data: { track: { id: 'track-med' } } };
      }
      if (String(url).includes('/api/career/profile')) {
        return { data: {} };
      }
      return { data: {} };
    });

    const trackId = await persistMedCareerTrack(session, 'token');
    expect(trackId).toBe('track-med');
    expect(mockedAxios.put).toHaveBeenCalledWith(
      expect.stringContaining('/tracks/track-med/profile-data'),
      expect.objectContaining({
        profile_data: expect.objectContaining({
          enriched: expect.objectContaining({
            role_family: 'medicine',
            job_preferences: expect.objectContaining({ target_role: 'Врач-терапевт' }),
          }),
        }),
      }),
      expect.any(Object)
    );
  });
});
