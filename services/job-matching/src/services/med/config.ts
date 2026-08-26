/**
 * LEO Med vertical feature flag.
 * Off by default — no effect on Jack IT matching / extended sources.
 * Spec: docs/MED_VERTICAL_BRIEF.md (Phase 0)
 */

export function isMedVerticalEnabled(): boolean {
  return process.env.ENABLE_MED_VERTICAL === 'true';
}
