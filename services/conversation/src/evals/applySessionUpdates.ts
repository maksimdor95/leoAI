import { PreparedStepResult } from '../types/scenario';
import { ConversationSession } from '../types/session';

/** Mirrors sessionService.updateSessionMetadata merge logic for in-memory eval sessions. */
export function applySessionUpdates(
  session: ConversationSession,
  updates?: PreparedStepResult['metadataUpdates']
): void {
  if (!updates) return;

  session.metadata = {
    ...session.metadata,
    ...updates,
    collectedData: {
      ...session.metadata.collectedData,
      ...(updates.collectedData || {}),
    },
    completedSteps: Array.from(
      new Set([
        ...(session.metadata.completedSteps || []),
        ...((updates.completedSteps || []) as string[]),
      ])
    ),
    flags: {
      ...(session.metadata.flags || {}),
      ...(updates.flags || {}),
    },
  };
}
