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

export type CareerAccountSnapshot = {
  tracks: CareerTrackSummary[];
  selectedTrack: CareerTrackSummary | null;
  enriched: EnrichedProfileView | null;
};

function enrichedFromTrack(track: CareerTrackSummary | null): EnrichedProfileView | null {
  if (!track) return null;

  const fields =
    track.profile_data?.fields && typeof track.profile_data.fields === 'object'
      ? (track.profile_data.fields as Record<string, unknown>)
      : {};

  const stored = track.profile_data?.enriched ?? null;
  const mergedFields: Record<string, unknown> = {
    ...fields,
    desired_role:
      fields.desired_role ?? fields.desiredRole ?? track.target_role ?? undefined,
    totalExperience: fields.totalExperience ?? track.experience_years ?? undefined,
    ...(stored ? { __enriched: stored } : {}),
  };

  const resolved = resolveDisplayEnrichedProfile(mergedFields);
  if (resolved && hasCareerSnapshotData(resolved)) {
    return resolved;
  }
  if (stored && hasCareerSnapshotData(stored)) {
    return { ...stored, isFallback: false };
  }

  return buildFallbackEnrichedProfile(mergedFields);
}

export function trackDisplayLabel(track: CareerTrackSummary): string {
  const target = track.target_role?.trim();
  if (target) {
    const short = target.split(/[\/|,]/)[0]?.trim();
    return short || target;
  }
  return track.name?.trim() || 'Направление';
}

export async function fetchCareerAccountSnapshot(
  preferredTrackId?: string | null
): Promise<CareerAccountSnapshot> {
  const base = getPublicApiBaseUrl();
  const profileRes = await fetch(`${base}/api/users/profile`, { credentials: 'include' });
  if (!profileRes.ok) {
    return { tracks: [], selectedTrack: null, enriched: null };
  }
  const user = (await profileRes.json()) as { id?: string };
  if (!user.id) {
    return { tracks: [], selectedTrack: null, enriched: null };
  }

  const careerRes = await fetch(`${base}/api/career/career-profile/${user.id}`, {
    credentials: 'include',
  });
  if (!careerRes.ok) {
    return { tracks: [], selectedTrack: null, enriched: null };
  }
  const data = (await careerRes.json()) as {
    careerProfile?: CareerTrackSummary;
    tracks?: CareerTrackSummary[];
  };

  const tracks = data.tracks?.length
    ? data.tracks
    : data.careerProfile
      ? [data.careerProfile]
      : [];

  const selectedTrack =
    (preferredTrackId ? tracks.find((t) => t.id === preferredTrackId) : null) ??
    data.careerProfile ??
    tracks.find((t) => t.is_default) ??
    tracks[0] ??
    null;

  return {
    tracks,
    selectedTrack,
    enriched: enrichedFromTrack(selectedTrack),
  };
}

/** @deprecated Prefer fetchCareerAccountSnapshot — kept for callers that only need enriched. */
export async function fetchDefaultCareerEnriched(): Promise<EnrichedProfileView | null> {
  const snap = await fetchCareerAccountSnapshot();
  return snap.enriched;
}

export async function setDefaultCareerTrack(trackId: string): Promise<CareerTrackSummary | null> {
  const base = getPublicApiBaseUrl();
  const res = await fetch(`${base}/api/career/tracks/${trackId}/set-default`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { track?: CareerTrackSummary };
  return data.track ?? null;
}
