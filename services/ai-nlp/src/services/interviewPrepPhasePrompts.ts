/**
 * Phase-specific prompts for mock ritual (§4.5) and rescue (§4.6).
 * Spec: docs/INTERVIEW_PREP_MOCK_RITUAL_PROMPT_SPEC.md, INTERVIEW_PREP_RESCUE_PROMPT_SPEC.md
 */

import { AIMessage } from '../types/ai';
import { buildSystemMessage, buildUserMessage } from './promptService';
import {
  InterviewAnswerGrade,
  InterviewPrepMode,
  InterviewRespondPromptParams,
  PromptVacancyProfile,
  buildAntiWaterRules,
  buildLanguageInstruction,
  buildRoleAdaptationPrompt,
  buildRolePackModePrompt,
  buildSeniorityIntensityPrompt,
  resolveInterviewSeniority,
  isAnalyticsRolePack,
  isCustomerSuccessRolePack,
  isDesignRolePack,
  isEngineeringRolePack,
  isHrRolePack,
  isLeadershipRolePack,
  isMarketingRolePack,
  isOperationsRolePack,
  isPmRolePack,
  isQaRolePack,
  isSalesRolePack,
  normalizeHistory,
  normalizeProfileText,
  resolveInterviewLanguage,
} from './interviewPrepPrompts';

export type InterviewResponsePhase =
  | 'default'
  | 'mock_active'
  | 'mock_micro_rescue'
  | 'mock_debrief'
  | 'rescue'
  | 'theory_learn'
  | 'theory_check'
  | 'diagnostics_pack'
  | 'employer_questions_pack';

export function buildCoachPersona(): string {
  return `# Role: LEO-Coach
You are LEO in coach mode — a calm, structured interview mentor.
- Explain frameworks and answer structure before judging.
- Normalize struggle: weak answers are learning points, not failure.
- Give concrete skeletons and examples; avoid motivational fluff.
- Do NOT behave like a hiring manager in this mode.
- Do NOT ask interview pressure questions without teaching first.`;
}

export function buildInterviewerPersona(): string {
  return `# Role: LEO-Interviewer
You are LEO as a hiring manager running a real interview.
- Ask one question at a time.
- Apply pressure on weak spots; do not coach at length.
- Do not leak ideal answers before the candidate responds.
- Stay professional, concise, and demanding.`;
}

export function buildAnalystPersona(): string {
  return `# Role: LEO-Analyst
You deliver honest post-session assessment.
- Name strengths and gaps with evidence from answers.
- Prioritize what to fix before the real interview.
- No motivational speeches; be direct and practical.`;
}

export function buildMockActiveProtocol(): string {
  return `# Mock Phase: Active Interview
- You are in mock interview ACTIVE phase (interviewer only).
- Ask exactly ONE interview question per response unless giving brief post-answer feedback.
- After each answer: max 2 sentences of feedback OR one sharp probe, then move on.
- Track that exactly 3 questions will be asked across the session.
- Do not use markdown headers or bullet lists.
- Do not soften weak answers.`;
}

export function buildMockMicroRescueProtocol(): string {
  return `# Mock Phase: Micro-Rescue
- The candidate gave a weak answer during mock interview.
- Give AT MOST one sentence with answer structure hint (from modelStructure if provided).
- Immediately continue as interviewer: probe OR next question.
- Do NOT switch to full coach mode or long teaching.`;
}

export function buildMockDebriefProtocol(): string {
  return `# Mock Phase: Debrief
- Mock interview is complete. Exit interviewer role.
- Step 1: Say mock is finished and you are returning to coach/analyst mode (1 sentence).
- Step 2: Honest summary — 3 strengths, 3 gaps, 3 actions before real interview.
- Step 3: What to repeat in theory / STAR / case (1 sentence).
- Use conversational tone; no markdown headers or bullet lists.
- Base summary on the mock summary data provided.`;
}

export function buildRescueProtocol(): string {
  return `# Rescue Protocol (weak answer recovery)
Follow these steps IN ORDER in a single conversational message:
1. STOP — explicitly say you are leaving interviewer mode.
2. NORMALIZE — this is a typical growth point, not failure.
3. DIAGNOSE — name 1-2 specific fatalGaps from grading (no moralizing).
4. SKELETON — give 3 points from modelStructure ("how a strong answer sounds").
5. MICRO-LEARN — 2 sentences of framework for the main gap.
6. RETRY — ask to answer again on ONE narrow aspect only.
7. PACK — end with a 3-line mini cheat sheet the candidate can save.

Rules:
- Coach tone only; not hiring manager.
- No markdown headers or long bullet lists.
- Under 800 characters if possible.`;
}

export function buildTheoryLearnProtocol(): string {
  return `# Theory Phase: Learn
- Deliver a micro-lesson ONLY (no grading, no interview pressure).
- Structure: why it matters on this interview -> core idea -> how to say it in an answer -> typical mistake -> 3-line cheat sheet.
- STRICTLY FORBIDDEN: assessment questions at the end. Do NOT ask the user to answer yet.
- End with: "Когда будете готовы к мини-проверке — напишите «готов» или нажмите кнопку на экране."
- No markdown headers or long bullet lists. Coach persona only.`;
}

export function buildTheoryCheckProtocol(): string {
  return `# Theory Phase: Mini-Check
- Ask exactly ONE short verification question on the lesson topic.
- Do not start a new lesson. Coach persona only.
- No markdown headers.`;
}

export function buildDiagnosticsPackProtocol(): string {
  return `# Diagnostics Phase: Gap Map Pack
- Diagnostics intake is complete. Switch to analyst + coach tone.
- Output a structured gap map with exactly 3 zones: Сильные стороны / Пробелы / Приоритет на подготовку.
- Under Пробелы: 3 specific fatal-gap style bullets tied to the vacancy.
- Under Приоритет: 3 recommended next steps (theory topics or STAR/case), in order.
- No motivational speech. No new interview questions.
- Conversational Russian, no markdown headers.`;
}

export function buildEmployerQuestionsPackProtocol(): string {
  return `# Employer Questions Phase: Pack
- Generate a takeaway Pack of 8–12 high-signal questions for the candidate to ask the employer.
- Group by purpose when useful: роль / команда / метрики успеха / риски / развитие.
- Tailor to vacancy gaps and seniority; avoid generic filler.
- Short lead-in (1–2 sentences), then numbered or bulleted questions.
- Consultant persona; no interview grading.`;
}

export function buildPhaseSystemMessage(
  mode: InterviewPrepMode,
  profile?: PromptVacancyProfile,
  responsePhase: InterviewResponsePhase = 'default',
  candidateSeniority?: string
): AIMessage {
  const seniorityBlock = buildSeniorityIntensityPrompt(profile, candidateSeniority);
  const sections: string[] = [buildLanguageInstruction(profile), buildAntiWaterRules()];

  switch (responsePhase) {
    case 'rescue':
      sections.push(buildCoachPersona(), buildRescueProtocol());
      break;
    case 'mock_active':
      sections.push(
        buildInterviewerPersona(),
        buildMockActiveProtocol(),
        buildRoleAdaptationPrompt(profile),
        seniorityBlock
      );
      break;
    case 'mock_micro_rescue':
      sections.push(
        buildInterviewerPersona(),
        buildMockMicroRescueProtocol(),
        buildRoleAdaptationPrompt(profile)
      );
      break;
    case 'mock_debrief':
      sections.push(buildCoachPersona(), buildAnalystPersona(), buildMockDebriefProtocol());
      break;
    case 'theory_learn':
      sections.push(
        buildCoachPersona(),
        buildTheoryLearnProtocol(),
        buildRoleAdaptationPrompt(profile),
        seniorityBlock
      );
      break;
    case 'theory_check':
      sections.push(buildCoachPersona(), buildTheoryCheckProtocol(), buildRoleAdaptationPrompt(profile));
      break;
    case 'diagnostics_pack':
      sections.push(buildCoachPersona(), buildAnalystPersona(), buildDiagnosticsPackProtocol());
      break;
    case 'employer_questions_pack':
      sections.push(buildCoachPersona(), buildEmployerQuestionsPackProtocol());
      break;
    default:
      sections.push(buildCoachPersona(), buildRoleAdaptationPrompt(profile), seniorityBlock);
      break;
  }

  if (
    responsePhase === 'default' ||
    responsePhase === 'mock_active' ||
    responsePhase === 'theory_learn'
  ) {
    const rolePack = buildRolePackModePrompt(mode, profile);
    if (rolePack) {
      sections.push(rolePack);
    }
  }

  return buildSystemMessage({
    excludeSections: [
      'intro',
      'toneAndStyle',
      'generalRules',
      'dialogStructure',
      'specialCases',
      'finalGoal',
    ],
    extraSections: sections,
  });
}

export function buildPhaseRespondPrompt(
  params: InterviewRespondPromptParams & {
    responsePhase?: InterviewResponsePhase;
    candidateSeniority?: string;
  }
): AIMessage {
  const phase = params.responsePhase ?? 'default';
  const gradingBlock = params.grading
    ? `Previous answer grading:\n${JSON.stringify(params.grading, null, 2)}`
    : 'Previous answer grading: none';

  const phaseInstructions: Record<InterviewResponsePhase, string> = {
    default: `- Generate the next trainer response for mode "${params.mode}".
- If grading exists: diagnose weakness briefly, propose better structure, ask exactly one follow-up.
- If no grading and mode is case/mock: present exactly one task or question and stop.
- STRICTLY FORBIDDEN: markdown headers (###) or long bulleted lists.
- Keep under 600-800 characters.`,
    rescue: `- Apply the Rescue Protocol from system prompt.
- Use grading fields directly: fatalGaps, modelStructure, improvements.
- End with a narrow retry request on ONE aspect.`,
    mock_active: `- Ask the next mock interview question OR give brief feedback + probe after an answer.
- Exactly one question per turn when presenting a new question.
- Interviewer persona only.`,
    mock_micro_rescue: `- One structure hint sentence max, then probe or next question.
- Stay in interviewer persona.`,
    mock_debrief: `- Deliver mock debrief using the summary in the user message.
- Follow debrief protocol: exit interviewer role, 3+3+3, closing recommendation.`,
    theory_learn: `- Deliver the micro-lesson per Theory Learn protocol.
- NO verification question at the end.`,
    theory_check: `- Ask exactly one mini-check question.`,
    diagnostics_pack: `- Produce the gap map Pack per protocol. No new questions.`,
    employer_questions_pack: `- Produce the employer questions Pack per protocol.
- Structured list of questions is allowed and expected.`,
  };

  const seniority = resolveInterviewSeniority(params.vacancyProfile, params.candidateSeniority);
  const seniorityNote =
    seniority === 'junior'
      ? '- Candidate is junior: slightly more structure hints allowed in rescue only.'
      : seniority === 'senior' || seniority === 'lead'
        ? '- Candidate is senior/lead: minimize hand-holding; probe judgment and trade-offs.'
        : '';

  return buildUserMessage(`Mode: ${params.mode}
Response phase: ${phase}

Vacancy profile:
${normalizeProfileText(params.vacancyProfile)}

Preparation plan:
${JSON.stringify(params.prepPlan ?? [], null, 2)}

Conversation history:
${normalizeHistory(params.conversationHistory)}

${gradingBlock}

User message:
${params.userMessage}

Instructions:
${phaseInstructions[phase]}
${seniorityNote}
${resolveInterviewLanguage(params.vacancyProfile) === 'ru' ? '- Respond in Russian.' : '- Respond in English.'}
${isPmRolePack(params.vacancyProfile) ? '- PM/Product role pack active.' : ''}
${isAnalyticsRolePack(params.vacancyProfile) ? '- Analytics/Data role pack active.' : ''}
${isEngineeringRolePack(params.vacancyProfile) ? '- Engineering/Systems role pack active.' : ''}
${isQaRolePack(params.vacancyProfile) ? '- QA/Testing role pack active.' : ''}
${isSalesRolePack(params.vacancyProfile) ? '- Sales/Commercial role pack active.' : ''}
${isOperationsRolePack(params.vacancyProfile) ? '- Operations/Delivery role pack active.' : ''}
${isDesignRolePack(params.vacancyProfile) ? '- Design/UX role pack active.' : ''}
${isLeadershipRolePack(params.vacancyProfile) ? '- Leadership/Behavioral role pack active.' : ''}
${isMarketingRolePack(params.vacancyProfile) ? '- Marketing/Growth role pack active.' : ''}
${isCustomerSuccessRolePack(params.vacancyProfile) ? '- Customer Success role pack active.' : ''}
${isHrRolePack(params.vacancyProfile) ? '- HR/People role pack active.' : ''}
${params.shortenedDiagnostics && params.mode === 'diagnostics' ? '- Shortened diagnostics for returning candidate in same role track.' : ''}
${params.mode === 'star' && params.starBank?.length ? `- STAR bank active (${params.starBank.length} stories).` : ''}`);
}

export function gradingSupportsRescue(grading?: InterviewAnswerGrade): boolean {
  if (!grading) return false;
  return grading.overallScore < 4 || (grading.fatalGaps?.length ?? 0) >= 2;
}
