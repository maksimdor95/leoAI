import { handleUserReply } from '../services/dialogueEngine';
import { ConversationSession } from '../types/session';
import { applySessionUpdates } from './applySessionUpdates';
import { JackPersonaFixture } from './fixtures/types';

export interface PersonaEvalResult {
  personaId: string;
  completed: boolean;
  finalStepId: string | undefined;
  clarifyCount: number;
  stepsTaken: number;
  stepTrail: string[];
  durationMs: number;
  missingKeys: string[];
}

export function createEvalSession(persona: JackPersonaFixture): ConversationSession {
  return {
    id: `eval-${persona.id}`,
    userId: 'eval-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    metadata: {
      product: persona.product,
      scenarioId: persona.scenarioId,
      currentStepId: 'greeting',
      status: 'active',
      collectedData: {},
      completedSteps: [],
      flags: {},
    },
  };
}

export async function runJackPersonaEval(
  persona: JackPersonaFixture,
  authToken = 'eval-token'
): Promise<PersonaEvalResult> {
  const session = createEvalSession(persona);
  const stepTrail: string[] = [session.metadata.currentStepId || 'unknown'];
  let clarifyCount = 0;
  const startedAt = Date.now();

  for (const answer of persona.answers) {
    const result = await handleUserReply(session, answer, authToken);
    applySessionUpdates(session, result.metadataUpdates);

    if (session.metadata.currentStepId === 'clarify') {
      clarifyCount += 1;
    }

    stepTrail.push(session.metadata.currentStepId || 'null');
  }

  const collected = session.metadata.collectedData || {};
  const missingKeys = persona.requiredCollectedKeys.filter(
    (key) => collected[key] === undefined || collected[key] === ''
  );

  const finalStepId = session.metadata.currentStepId;
  const completed = finalStepId === persona.expectedFinalStepId && missingKeys.length === 0;

  return {
    personaId: persona.id,
    completed,
    finalStepId,
    clarifyCount,
    stepsTaken: stepTrail.length - 1,
    stepTrail,
    durationMs: Date.now() - startedAt,
    missingKeys,
  };
}
