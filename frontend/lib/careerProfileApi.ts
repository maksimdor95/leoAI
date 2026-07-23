import { getPublicApiBaseUrl } from '@/lib/publicApiBaseUrl';
import type { EnrichedProfileView } from '@/lib/enrichedProfileDisplay';
import {
  buildFallbackEnrichedProfile,
  hasCareerSnapshotData,
  resolveDisplayEnrichedProfile,
} from '@/lib/enrichedProfileDisplay';

export type CareerTrackSummary = {
  id: string;
  name: string;
  is_default?: boolean;
  target_role?: string | null;
  current_role?: string | null;
  experience_years?: number | null;
  profile_data?: {
    enriched?: EnrichedProfileView;
    fields?: Record<string, unknown>;
  } | null;
};

export async function fetchDefaultCareerEnriched(): Promise<EnrichedProfileView | null> {
  const base = getPublicApiBaseUrl();
  const profileRes = await fetch(`${base}/api/users/profile`, { credentials: 'include' });
  if (!profileRes.ok) return null;
  const user = (await profileRes.json()) as { id?: string };
  if (!user.id) return null;

  const careerRes = await fetch(`${base}/api/career/career-profile/${user.id}`, {
    credentials: 'include',
  });
  if (!careerRes.ok) return null;
  const data = (await careerRes.json()) as {
    careerProfile?: CareerTrackSummary;
    tracks?: CareerTrackSummary[];
  };
  const track = data.careerProfile ?? data.tracks?.find((t) => t.is_default) ?? data.tracks?.[0] ?? null;

  const fields =
    track?.profile_data?.fields && typeof track.profile_data.fields === 'object'
      ? (track.profile_data.fields as Record<string, unknown>)
      : {};

  const stored = track?.profile_data?.enriched ?? null;
  const mergedFields: Record<string, unknown> = {
    ...fields,
    desired_role:
      fields.desired_role ??
      fields.desiredRole ??
      track?.target_role ??
      undefined,
    totalExperience:
      fields.totalExperience ?? track?.experience_years ?? undefined,
    ...(stored ? { __enriched: stored } : {}),
  };

  // Пересчёт полноты по fields + skills из enriched (не доверяем устаревшим missing_fields)
  const resolved = resolveDisplayEnrichedProfile(mergedFields);
  if (resolved && hasCareerSnapshotData(resolved)) {
    return resolved;
  }
  if (stored && hasCareerSnapshotData(stored)) {
    return { ...stored, isFallback: false };
  }

  return buildFallbackEnrichedProfile(mergedFields);
}
