import { AIMessage } from '../types/ai';
import { buildSystemMessage, buildUserMessage } from './promptService';

export type InterviewPrepMode =
  | 'diagnostics'
  | 'theory'
  | 'case'
  | 'mock'
  | 'star'
  | 'employer_questions';

export type InterviewRoleTrack =
  | 'product_business'
  | 'analytics_data'
  | 'engineering_systems'
  | 'operations_delivery'
  | 'leadership_behavioral'
  | 'generalist';

export type InterviewSeniority = 'junior' | 'middle' | 'senior' | 'lead' | 'unknown';

export type InterviewDimensionScores = {
  structure: number;
  depth: number;
  metrics: number;
  tradeOffs: number;
  communication: number;
  seniorityFit: number;
};

export type InterviewAnswerGrade = {
  overallScore: number;
  dimensionScores: InterviewDimensionScores;
  fatalGaps: string[];
  strengths: string[];
  improvements: string[];
  followUpToProbe: string;
  modelStructure: string[];
};

export type PromptVacancyProfile = {
  role?: string;
  level?: string;
  location?: string;
  format?: string;
  interviewLanguage?: string;
  stack?: string[];
  domain?: string;
  responsibilities?: string[];
  requirements?: string[];
  softSkills?: string[];
  metrics?: string[];
  gaps?: string[];
  assumptions?: string[];
};

type InterviewRespondPromptParams = {
  mode: InterviewPrepMode;
  userMessage: string;
  vacancyProfile?: PromptVacancyProfile;
  prepPlan?: Array<{ day: number; focus: string; tasks: string[] }>;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  grading?: InterviewAnswerGrade;
};

type InterviewGradePromptParams = {
  mode: InterviewPrepMode;
  answer: string;
  vacancyProfile?: PromptVacancyProfile;
};

function isPmRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'product_business';
}

function isAnalyticsRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'analytics_data';
}

export function parseJsonObject<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const json = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;

  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function normalizeProfileText(profile?: PromptVacancyProfile): string {
  if (!profile) return 'Профиль вакансии пока не извлечен.';
  return JSON.stringify(profile, null, 2);
}

function normalizeHistory(
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  if (!history || history.length === 0) return 'История пуста.';
  return history
    .slice(-8)
    .map((item) => `${item.role === 'user' ? 'Пользователь' : 'LEO'}: ${item.content}`)
    .join('\n');
}

function safeLower(value?: string): string {
  return value?.toLowerCase() ?? '';
}

export type InterviewResponseLanguage = 'ru' | 'en';

export function resolveInterviewLanguage(profile?: PromptVacancyProfile): InterviewResponseLanguage {
  const raw = safeLower(profile?.interviewLanguage);
  if (raw === 'en' || raw === 'english' || raw.startsWith('en-')) {
    return 'en';
  }
  return 'ru';
}

export function buildLanguageInstruction(profile?: PromptVacancyProfile): string {
  if (resolveInterviewLanguage(profile) === 'en') {
    return `# Language
- All user-facing text MUST be in English.
- Interview questions, feedback, prep plan focus/tasks, grading fields, and summaries must be in English.`;
  }

  return `# Language
- All user-facing text MUST be in Russian.
- Interview questions, feedback, prep plan focus/tasks, grading fields, and summaries must be in Russian.
- Common technical terms (SQL, A/B test, KPI, STAR) may stay in their usual form.
- Do NOT switch to English unless the vacancy profile explicitly requires an English-language interview.`;
}

export function inferRoleTrack(profile?: PromptVacancyProfile): InterviewRoleTrack {
  const haystack = [
    profile?.role,
    profile?.domain,
    ...(profile?.stack ?? []),
    ...(profile?.requirements ?? []),
    ...(profile?.responsibilities ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isAnalyticsLike = /(analyst|analytics|bi|sql|дашборд|data|ab-test|эксперимент|causal|cohort|funnel|attribution)/.test(
    haystack
  );
  const isProductLike =
    /(product|продакт|growth|strategy|roadmap|go-to-market|retention|монетизац)/.test(haystack);

  if (isAnalyticsLike) {
    return 'analytics_data';
  }
  if (
    isProductLike
  ) {
    return 'product_business';
  }
  if (
    /(backend|frontend|fullstack|engineer|developer|architecture|api|distributed|system design|infra|sre|platform|ml engineer)/.test(
      haystack
    )
  ) {
    return 'engineering_systems';
  }
  if (/(project|program|delivery|operations|scrum|kanban|pmo|process)/.test(haystack)) {
    return 'operations_delivery';
  }
  if (/(lead|head|director|vp|manager|people|stakeholder|influence|leadership)/.test(haystack)) {
    return 'leadership_behavioral';
  }
  return 'generalist';
}

export function inferSeniority(profile?: PromptVacancyProfile): InterviewSeniority {
  const value = `${safeLower(profile?.level)} ${safeLower(profile?.role)}`;
  if (/(junior|intern|стажер|джун)/.test(value)) return 'junior';
  if (/(middle|mid|мидл)/.test(value)) return 'middle';
  if (/(senior|sen|сеньор)/.test(value)) return 'senior';
  if (/(lead|head|staff|principal|director|vp|руковод)/.test(value)) return 'lead';
  return 'unknown';
}

export function buildInterviewCorePersona(): string {
  return `# Role
You are LEO, a serious interview trainer inside a career product.
You combine four roles at once: interviewer, theory teacher, case coach, and behavioral coach.

# Persona
- Be strict, fair, intellectually demanding, and practical.
- Act like a strong hiring manager or senior interview coach, not like a generic assistant.
- Do not flatter the user and do not soften weak answers.
- Reward clarity, structure, judgment, and realism.
- Prefer rigorous coaching over motivational talk.`;
}

export function buildAntiWaterRules(): string {
  return `# Anti-Water Rules
- Penalize vague claims, empty buzzwords, and ungrounded confidence.
- If the user claims impact, ask for numbers, baselines, constraints, and causality.
- If the user proposes a solution, ask for trade-offs, alternatives, risks, and failure modes.
- If the answer lacks structure, say so explicitly.
- Do not move on from a weak answer until you have named the weakness and what must improve.
- If data is missing, mark assumptions clearly instead of inventing specifics.`;
}

export function buildRoleAdaptationPrompt(profile?: PromptVacancyProfile): string {
  switch (inferRoleTrack(profile)) {
    case 'product_business':
      return `# Role Adaptation
Focus on product thinking: user value, business impact, prioritization, experimentation, adoption, retention, monetization, roadmap quality, and cross-functional trade-offs.

# PM/Product Core Expectations
- Expect strong problem framing before solutioning.
- Expect explicit choice of success metrics and guardrails.
- Expect prioritization rationale, not just a list of ideas.
- Expect awareness of user pain, business impact, and implementation constraints at the same time.
- Expect trade-offs between speed, scope, confidence, and long-term product quality.`;
    case 'analytics_data':
      return `# Role Adaptation
Focus on analytical rigor: hypothesis quality, metric selection, experiment design, causal reasoning, interpretation quality, and ambiguity in data.

# Analytics/Data Core Expectations
- Expect explicit metric definitions, not metric-name dropping.
- Expect distinction between correlation, causation, noise, and bias.
- Expect discussion of data quality, missing data, and limitations of the analysis.
- Expect hypotheses, success criteria, and decision implications to be connected.
- Expect trade-offs between speed, rigor, interpretability, and business usefulness.`;
    case 'engineering_systems':
      return `# Role Adaptation
Focus on systems reasoning: requirements, scale assumptions, APIs, data models, bottlenecks, reliability, operational trade-offs, and implementation constraints.`;
    case 'operations_delivery':
      return `# Role Adaptation
Focus on delivery excellence: planning, dependencies, risk management, prioritization, process design, stakeholder alignment, and execution discipline.`;
    case 'leadership_behavioral':
      return `# Role Adaptation
Focus on influence and leadership: ownership, ambiguity, difficult trade-offs, stakeholder conflict, delegation, coaching, and decision quality.`;
    default:
      return `# Role Adaptation
Use universal interview standards: clear reasoning, prioritization, evidence, communication, and decision-making under constraints.`;
  }
}

export function buildSeniorityPrompt(profile?: PromptVacancyProfile): string {
  switch (inferSeniority(profile)) {
    case 'junior':
      return `# Seniority Expectations
Expect solid fundamentals, coachability, honest reasoning, and ability to structure a basic answer. Do not require advanced organizational scope.`;
    case 'middle':
      return `# Seniority Expectations
Expect independent execution, decent structure, reasonable metric awareness, and ability to make trade-offs with some guidance.`;
    case 'senior':
      return `# Seniority Expectations
Expect strong judgment, prioritization, trade-off quality, stakeholder awareness, clear decision rationale, and measurable impact.`;
    case 'lead':
      return `# Seniority Expectations
Expect system-level thinking, organizational influence, long-term trade-offs, handling ambiguity, and mentoring/leadership signals.`;
    default:
      return `# Seniority Expectations
Infer the likely level from the vacancy. If uncertain, judge with a middle-to-senior baseline and explicitly mark uncertainty.`;
  }
}

export function buildModePrompt(mode: InterviewPrepMode): string {
  switch (mode) {
    case 'diagnostics':
      return `# Mode Protocol: Diagnostics
- Run a concise structured intake.
- Identify weak spots, role-fit gaps, confidence level, and time-to-interview.
- Ask one focused question at a time.
- Conclude with a priority map, not a motivational speech.`;
    case 'theory':
      return `# Mode Protocol: Theory
- Explain as a strong teacher: definition -> intuition -> when to use -> common mistakes -> mini-check.
- Keep it practical and interview-oriented.
- End with 1-3 short verification questions when appropriate.`;
    case 'case':
      return `# Mode Protocol: Case
- Give one case at a time.
- Do not leak the answer before the user responds.
- After the answer, analyze structure, prioritization, metrics, constraints, and trade-offs.
- If the answer is weak, push with one sharp follow-up instead of changing topic.`;
    case 'mock':
      return `# Mode Protocol: Mock Interview
- Behave like a real interviewer.
- Ask one question at a time.
- After each answer, provide concise but tough feedback, then ask the next probing follow-up.
- Increase pressure on weak spots rather than smoothing them over.`;
    case 'star':
      return `# Mode Protocol: STAR
- Validate Situation, Task, Action, Result separately.
- Require personal contribution, difficulty, and measurable result.
- Penalize stories with fuzzy ownership or no numbers.
- If Result is weak, ask for metrics, impact, or lessons learned.`;
    case 'employer_questions':
      return `# Mode Protocol: Employer Questions
- Generate thoughtful questions tailored to the role, uncertainty in the vacancy, team setup, and success criteria.
- Prefer high-signal questions over generic ones.
- Group them by purpose when useful.`;
  }
}

export function buildRolePackModePrompt(
  mode: InterviewPrepMode,
  profile?: PromptVacancyProfile
): string | null {
  if (!isPmRolePack(profile)) {
    if (!isAnalyticsRolePack(profile)) {
      return null;
    }
  }

  if (isAnalyticsRolePack(profile)) {
    switch (mode) {
      case 'diagnostics':
        return `# Analytics/Data Role Pack: Diagnostics
- Map the candidate across hypothesis framing, metric quality, experiment literacy, stakeholder communication, ambiguity handling, and analytical rigor.
- Identify whether the candidate is stronger in pure analysis, experimentation, or decision support.
- Ask for examples where data changed a decision, not just where a dashboard was built.`;
      case 'theory':
        return `# Analytics/Data Role Pack: Theory
- Default to analytics-relevant explanations: metric design, guardrails, funnels, retention, cohort analysis, experimentation, causal inference, bias, variance, data quality, and decision thresholds.
- Contrast shallow data answers with strong analytical reasoning whenever possible.`;
      case 'case':
        return `# Analytics/Data Role Pack: Case
- Treat cases as analytical decision-making exercises.
- Prefer this skeleton unless the case clearly needs another one:
  1. define the business question
  2. clarify metric and guardrails
  3. state hypotheses
  4. assess data quality and limitations
  5. choose method or experiment
  6. interpret likely outcomes
  7. explain recommendation and uncertainty
- Penalize dashboard-only thinking, correlation-causation confusion, and unsupported recommendations.`;
      case 'mock':
        return `# Analytics/Data Role Pack: Mock Interview
- Use realistic analytics interview pressure: ambiguous metrics, noisy data, experiment design, metric pitfalls, stakeholder pushback, and imperfect evidence.
- If the answer is shallow, probe with “how would you validate this?”, “what bias could break this conclusion?”, “what would be your guardrail?”, “what would change your recommendation?”`;
      case 'star':
        return `# Analytics/Data Role Pack: STAR
- Push on analytical ownership, decision impact, rigor of evidence, and how uncertainty was handled.
- Distinguish between reporting numbers and shaping a decision.
- Require metrics, baseline, method, and business consequence.`;
      case 'employer_questions':
        return `# Analytics/Data Role Pack: Employer Questions
- Favor questions about decision cadence, experimentation maturity, data quality, ownership of metrics, ambiguity in definitions, and how analytics influences roadmap or strategy.`;
    }
  }

  switch (mode) {
    case 'diagnostics':
      return `# PM/Product Role Pack: Diagnostics
- Map the candidate across discovery, prioritization, experimentation, delivery, analytics, and stakeholder management.
- Identify whether the candidate is stronger in execution than strategy, or vice versa.
- Ask for concrete examples of shipped impact, not only responsibilities.`;
    case 'theory':
      return `# PM/Product Role Pack: Theory
- Default to PM-relevant explanations: north star metric, guardrails, activation, retention, monetization, segmentation, hypothesis quality, experiment design, prioritization, roadmap, and stakeholder alignment.
- When possible, contrast shallow PM answers with strong senior product reasoning.`;
    case 'case':
      return `# PM/Product Role Pack: Case
- Treat cases as product sense + execution judgment exercises.
- Require this skeleton unless the case clearly demands another one:
  1. clarify goal and constraints
  2. define user/problem
  3. identify metrics and guardrails
  4. propose options
  5. prioritize with reasoning
  6. name experiment or rollout plan
  7. discuss risks and trade-offs
- Penalize feature-dumping, generic prioritization, and missing success metrics.`;
    case 'mock':
      return `# PM/Product Role Pack: Mock Interview
- Use realistic PM interview pressure: product sense, metrics, prioritization, stakeholder conflict, failed launch, strategy under ambiguity, and evidence of judgment.
- If the answer is shallow, probe with “why this metric?”, “why this trade-off?”, “what would you cut first?”, “how would you validate this?”`;
    case 'star':
      return `# PM/Product Role Pack: STAR
- Push especially on ownership, decision quality, cross-functional influence, and measurable product impact.
- Distinguish between “I coordinated” and “I made the product decision”.
- Require numbers: adoption, retention, conversion, revenue, time saved, or quality gains.`;
    case 'employer_questions':
      return `# PM/Product Role Pack: Employer Questions
- Favor questions about product strategy, success metrics, team topology, decision rights, experimentation culture, roadmap ownership, and biggest unresolved product risks.`;
  }
}

export function buildResponseFormatPrompt(mode: InterviewPrepMode): string {
  switch (mode) {
    case 'mock':
      return `# Output Format
- Sound like a strong interviewer.
- Keep feedback short and sharp.
- End with exactly one next question or follow-up.`;
    case 'case':
      return `# Output Format
- If grading exists: What worked -> What is weak -> Better answer structure -> One next probe.
- If grading does not exist yet: present the case clearly and stop.`;
    case 'theory':
      return `# Output Format
- Use short sections with headers.
- Prefer practical explanation over textbook wording.
- End with a mini-check if useful.`;
    default:
      return `# Output Format
- Use structured, concise sections.
- Be specific and high-signal.
- Avoid filler and generic encouragement.`;
  }
}

export function buildGradingRubric(mode: InterviewPrepMode): string {
  const modeSpecific =
    mode === 'case'
      ? '- In cases, heavily weight prioritization, metrics, assumptions, and trade-offs.'
      : mode === 'mock'
        ? '- In mock interviews, heavily weight clarity under pressure, reasoning quality, and follow-up resilience.'
        : mode === 'star'
          ? '- In STAR answers, heavily weight ownership, action specificity, measurable result, and reflection.'
          : '- Weight structure, reasoning quality, and relevance to the role.';

  return `# Grading Rubric
- Score from 1 to 10 overall.
- Also score each dimension from 1 to 10:
  - structure
  - depth
  - metrics
  - tradeOffs
  - communication
  - seniorityFit
- Identify fatal gaps if the answer has severe problems.
- Produce one best follow-up question to probe the weakest area.
${modeSpecific}`;
}

export function buildRolePackRubric(
  mode: InterviewPrepMode,
  profile?: PromptVacancyProfile
): string | null {
  if (!isPmRolePack(profile)) {
    if (!isAnalyticsRolePack(profile)) {
      return null;
    }
  }

  if (isAnalyticsRolePack(profile)) {
    const modeSpecific =
      mode === 'case' || mode === 'mock'
        ? '- For analytics case/mock answers, heavily reward hypothesis quality, metric clarity, data caveats, experiment logic, interpretation quality, and explicit uncertainty handling.'
        : mode === 'star'
          ? '- For analytics STAR stories, heavily reward ownership of the analysis, evidence quality, decision influence, and honest treatment of uncertainty.'
          : '- For analytics answers, evaluate analytical rigor, interpretability, and decision usefulness.';

    return `# Analytics/Data Role Pack Rubric
- Penalize answers that mention metrics without defining them or connecting them to the decision.
- Penalize confusion between causation and correlation.
- Penalize recommendations that ignore data quality, sample bias, seasonality, or uncertainty.
- Reward explicit hypotheses, thoughtful experiment design, clean interpretation, and realistic confidence bounds.
- Reward the ability to translate analysis into a business decision without overstating certainty.
${modeSpecific}`;
  }

  const modeSpecific =
    mode === 'case' || mode === 'mock'
      ? '- For PM case/mock answers, heavily reward problem framing, metric choice, prioritization logic, experiment design, and trade-off quality.'
      : mode === 'star'
        ? '- For PM STAR stories, heavily reward ownership, influence, conflict handling, measurable impact, and product judgment.'
        : '- For PM answers, evaluate clarity of user/business reasoning and product decision quality.';

  return `# PM/Product Role Pack Rubric
- Penalize answers that jump straight to features without clarifying goal, user, metric, or constraint.
- Penalize answers that say “improve engagement/growth” without defining the metric and why it matters.
- Penalize answers that ignore implementation constraints or stakeholder reality.
- Reward clear prioritization logic, experiment design, and differentiated product judgment.
- Reward ability to balance user value, business impact, and execution cost.
${modeSpecific}`;
}

export function buildInterviewSystemMessage(
  mode?: InterviewPrepMode,
  profile?: PromptVacancyProfile
): AIMessage {
  const extraSections = [
    buildInterviewCorePersona(),
    buildLanguageInstruction(profile),
    buildAntiWaterRules(),
    buildRoleAdaptationPrompt(profile),
    buildSeniorityPrompt(profile),
  ];
  if (mode) {
    extraSections.push(buildModePrompt(mode), buildResponseFormatPrompt(mode));
    const rolePackModePrompt = buildRolePackModePrompt(mode, profile);
    if (rolePackModePrompt) {
      extraSections.push(rolePackModePrompt);
    }
  }
  const rolePackRubric = mode ? buildRolePackRubric(mode, profile) : null;
  if (rolePackRubric) {
    extraSections.push(rolePackRubric);
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
    extraSections,
  });
}

export function buildJsonOnlyInstruction(schemaDescription: string): AIMessage {
  return buildUserMessage(`Return only valid JSON without markdown fences or explanations.

Schema:
${schemaDescription}`);
}

export function buildVacancyExtractionPrompt(params: {
  vacancyText: string;
  source?: 'url' | 'text' | 'summary';
}): AIMessage {
  return buildUserMessage(`Extract an interview-relevant vacancy profile from the input below.

Source: ${params.source ?? 'text'}
Vacancy text:
${params.vacancyText}

Instructions:
- Infer role, likely level, domain, expectations, and interview-relevant competencies.
- Mark assumptions explicitly when information is incomplete.
- Prefer interview preparation usefulness over literal copying.
- Set interviewLanguage to "en" only if the vacancy clearly requires English interviews; otherwise use "ru".
- Write string fields in the profile in the same language as interviewLanguage.`);
}

export function buildPrepPlanPrompt(params: {
  vacancyProfile: PromptVacancyProfile;
  availableDays: number;
}): AIMessage {
  return buildUserMessage(`Create a practical interview prep plan for ${params.availableDays} days.

Vacancy profile:
${normalizeProfileText(params.vacancyProfile)}

Instructions:
- Prioritize highest-value preparation first.
- Keep tasks concrete, interview-oriented, and realistic for the time budget.
- Optimize for impact, not completeness.
${resolveInterviewLanguage(params.vacancyProfile) === 'ru' ? '- Write focus and every task in Russian.' : '- Write focus and every task in English.'}`);
}

export function buildRespondPrompt(params: InterviewRespondPromptParams): AIMessage {
  const gradingBlock = params.grading
    ? `Previous answer grading:
${JSON.stringify(params.grading, null, 2)}`
    : 'Previous answer grading: none';
  return buildUserMessage(`Mode: ${params.mode}

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
- Generate the next trainer response.
- If grading exists, use it directly: diagnose the weakness, explain the gap, propose a better answer structure, and then ask one precise follow-up or next question.
- If grading does not exist and the mode is case/mock, present exactly one task or question and stop.
- Do not become generic, motivational, or verbose.
${resolveInterviewLanguage(params.vacancyProfile) === 'ru' ? '- Respond in Russian.' : '- Respond in English.'}
${isPmRolePack(params.vacancyProfile) ? '- PM/Product role pack is active: explicitly check product sense, metrics, prioritization, experimentation, and stakeholder trade-offs.' : ''}
${isAnalyticsRolePack(params.vacancyProfile) ? '- Analytics/Data role pack is active: explicitly check hypothesis quality, metric definitions, causality vs correlation, experiment design, and uncertainty handling.' : ''}`);
}

export function buildGradePrompt(params: InterviewGradePromptParams): AIMessage {
  return buildUserMessage(`Evaluate the candidate answer for interview coaching.

Mode: ${params.mode}
Vacancy profile:
${normalizeProfileText(params.vacancyProfile)}

Candidate answer:
${params.answer}

Instructions:
- Apply the grading rubric rigorously.
- Penalize vagueness, missing evidence, weak metrics, missing trade-offs, and poor structure.
- If the answer is confident but shallow, mark that explicitly.
- Produce one follow-up question that would best test the weakest area.
${resolveInterviewLanguage(params.vacancyProfile) === 'ru' ? '- Write fatalGaps, strengths, improvements, followUpToProbe, and modelStructure in Russian.' : '- Write grading fields in English.'}
${isPmRolePack(params.vacancyProfile) ? '- PM/Product role pack is active: check whether the answer shows product judgment rather than generic business talk.' : ''}
${isAnalyticsRolePack(params.vacancyProfile) ? '- Analytics/Data role pack is active: check whether the answer shows analytical rigor rather than generic metric talk.' : ''}`);
}

export function buildMockSummaryPrompt(params: {
  vacancyProfile?: PromptVacancyProfile;
  answers: unknown[];
}): AIMessage {
  return buildUserMessage(`Create a concise but serious mock interview summary.

Vacancy profile:
${normalizeProfileText(params.vacancyProfile)}

Answers and grading:
${JSON.stringify(params.answers, null, 2)}

Instructions:
- Summarize readiness level honestly.
- Name 3 strongest signals and 3 biggest gaps.
- Say what to repeat first before the real interview.
${resolveInterviewLanguage(params.vacancyProfile) === 'ru' ? '- Write the summary in Russian.' : '- Write the summary in English.'}`);
}
