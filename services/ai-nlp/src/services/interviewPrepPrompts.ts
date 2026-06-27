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
  | 'qa_quality'
  | 'sales_commercial'
  | 'operations_delivery'
  | 'design_ux'
  | 'leadership_behavioral'
  | 'marketing_growth'
  | 'customer_success'
  | 'hr_people'
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

export type InterviewRespondPromptParams = {
  mode: InterviewPrepMode;
  userMessage: string;
  vacancyProfile?: PromptVacancyProfile;
  prepPlan?: Array<{ day: number; focus: string; tasks: string[] }>;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  grading?: InterviewAnswerGrade;
  starBank?: Array<{
    role?: string;
    userMessage: string;
    modelStructure?: string[];
    overallScore?: number;
  }>;
  shortenedDiagnostics?: boolean;
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

function isEngineeringRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'engineering_systems';
}

function isQaRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'qa_quality';
}

function isSalesRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'sales_commercial';
}

function isOperationsRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'operations_delivery';
}

function isDesignRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'design_ux';
}

function isLeadershipRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'leadership_behavioral';
}

function isMarketingRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'marketing_growth';
}

function isCustomerSuccessRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'customer_success';
}

function isHrRolePack(profile?: PromptVacancyProfile): boolean {
  return inferRoleTrack(profile) === 'hr_people';
}

export {
  isPmRolePack,
  isAnalyticsRolePack,
  isEngineeringRolePack,
  isQaRolePack,
  isSalesRolePack,
  isOperationsRolePack,
  isDesignRolePack,
  isLeadershipRolePack,
  isMarketingRolePack,
  isCustomerSuccessRolePack,
  isHrRolePack,
};

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

export function normalizeProfileText(profile?: PromptVacancyProfile): string {
  if (!profile) return 'Профиль вакансии пока не извлечен.';
  return JSON.stringify(profile, null, 2);
}

export function normalizeHistory(
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

  const isAnalyticsLike =
    /(analyst|analytics|\bbi\b|\bsql\b|дашборд|\bdata\b|ab-test|эксперимент|causal|cohort|funnel|attribution)/.test(
      haystack
    );
  const isProductLike =
    /(product owner|product manager|\bproduct\b|продакт|growth|roadmap|go-to-market|retention|монетизац)/.test(
      haystack
    );
  const isMarketingLike =
    /(growth marketing|performance marketing|digital marketing|marketing manager|brand marketing|content marketing|crm marketing|email marketing|paid media|\bseo\b|\bsem\b|маркетинг|marketing director|head of marketing)/.test(
      haystack
    );
  if (isMarketingLike) {
    return 'marketing_growth';
  }
  if (isAnalyticsLike) {
    return 'analytics_data';
  }
  const isDesignLike =
    /(product designer|ux designer|ui designer|ux\/ui|user researcher|usability|design system|figma|interaction designer|design manager|head of design|design lead|ux lead|visual designer|дизайнер|исследователь ux|ux research)/.test(
      haystack
    );
  if (isDesignLike) {
    return 'design_ux';
  }
  if (isProductLike) {
    return 'product_business';
  }
  const isQaLike =
    /(quality assurance|\bqa\b|qa engineer|qa lead|тестиров|sdet|автотест|test automation|manual test|test engineer|test lead|software tester|инженер по тестированию|инженер-тестировщик)/.test(
      haystack
    );
  if (isQaLike) {
    return 'qa_quality';
  }
  if (
    /(backend|frontend|fullstack|engineer|developer|architecture|api|distributed|system design|infra|sre|platform|ml engineer)/.test(
      haystack
    ) &&
    !/(director|head of|vp|leadership)/.test(haystack)
  ) {
    return 'engineering_systems';
  }
  const isSalesLike =
    /(account executive|account manager|key account|business development|\bsdr\b|\bbdr\b|\bae\b|\bsales\b|продаж|коммерч|коммерческ|\bkam\b)/.test(
      haystack
    );
  if (isSalesLike) {
    return 'sales_commercial';
  }
  const isCustomerSuccessLike =
    /(customer success|client success|\bcsm\b|success manager|customer onboarding|onboarding manager|support lead|customer support lead|клиентский успех|удержание клиентов|account success)/.test(
      haystack
    );
  if (isCustomerSuccessLike) {
    return 'customer_success';
  }
  if (/(project manager|program manager|scrum master|release manager|pmo|delivery manager|project|program|delivery|scrum|kanban|pmo)/.test(haystack)) {
    return 'operations_delivery';
  }
  const isHrLike =
    /(recruiter|recruiting|talent acquisition|talent partner|hr bp|hr business partner|people partner|head of people|chief people officer|\bhr\b|рекрутер|рекрутинг|кадров|employer brand|sourcer)/.test(
      haystack
    );
  if (isHrLike) {
    return 'hr_people';
  }
  if (/(lead|head|director|vp|stakeholder|influence|leadership)/.test(haystack)) {
    return 'leadership_behavioral';
  }
  if (/\bmanager\b/.test(haystack)) {
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

/** §1.5 — explicit `candidateSeniority` from session overrides vacancy level. */
export function resolveInterviewSeniority(
  profile?: PromptVacancyProfile,
  explicitSeniority?: string
): InterviewSeniority {
  const explicit = explicitSeniority?.trim();
  if (explicit) {
    const fromExplicit = inferSeniority({ level: explicit, role: explicit });
    if (fromExplicit !== 'unknown') return fromExplicit;
  }
  const fromProfile = inferSeniority(profile);
  return fromProfile;
}

export function buildSeniorityPrompt(
  profile?: PromptVacancyProfile,
  explicitSeniority?: string
): string {
  switch (resolveInterviewSeniority(profile, explicitSeniority)) {
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

/** §1.5 LAR intensity matrix — appended to seniority expectations in prompts. */
export function buildSeniorityIntensityPrompt(
  profile?: PromptVacancyProfile,
  explicitSeniority?: string
): string {
  const seniority = resolveInterviewSeniority(profile, explicitSeniority);
  const base = buildSeniorityPrompt(profile, explicitSeniority);

  const intensityByLevel: Record<InterviewSeniority, string> = {
    junior: `# LAR Intensity (Junior)
- Learn: more lessons (3+ before mock), basic frameworks, more examples, step-by-step tone.
- Apply: low pressure, narrow-scope cases, gentle follow-ups.
- Reflect: softer, always give answer skeleton before retry.
- Pack: detailed templates and cheat sheets.
- Mock gate: diagnostics + 3 theory lessons + 1 STAR. Rescue attempts: up to 3.`,
    middle: `# LAR Intensity (Middle)
- Learn: standard depth (2 lessons before mock).
- Apply: standard interviewer pressure and case scope.
- Reflect: balanced coaching and probing.
- Pack: standard checklists.
- Mock gate: diagnostics + 2 lessons + 1 STAR. Rescue attempts: 2.`,
    senior: `# LAR Intensity (Senior)
- Learn: short targeted lessons on gaps only; skip basics.
- Apply: high pressure, full-scope cases, hard probes, fewer hints.
- Reflect: strict, minimal scaffolding.
- Pack: concise checklists, focus on trade-offs.
- Mock gate: standard. Rescue attempts: 1–2.`,
    lead: `# LAR Intensity (Lead)
- Learn: edge-cases and system judgment only.
- Apply: maximum pressure on org impact and stakeholder trade-offs.
- Reflect: focus on judgment under ambiguity.
- Pack: strategic employer questions, executive-level framing.
- Mock gate: may open earlier if diagnostics shows strength. Rescue attempts: 1.`,
    unknown: `# LAR Intensity (Default)
- Use middle-level intensity unless answers clearly signal junior or senior scope.`,
  };

  return `${base}\n\n${intensityByLevel[seniority]}`;
}

export function buildInterviewCorePersona(mode?: InterviewPrepMode): string {
  if (mode === 'case' || mode === 'mock') {
    return `# Role
You are LEO as a hiring manager and interview trainer.
- Ask one question at a time; apply pressure on weak answers.
- Be strict, fair, and practical — not a generic assistant.
- Do not flatter or soften weak answers.`;
  }
  return `# Role
You are LEO as an interview coach and theory teacher.
- Teach frameworks before testing; give structure and examples.
- Be strict but supportive — normalize struggle as growth.
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
Focus on systems reasoning: requirements, scale assumptions, APIs, data models, bottlenecks, reliability, operational trade-offs, and implementation constraints.

# Engineering/Systems Core Expectations
- Expect explicit requirements clarification before jumping to architecture.
- Expect scale, latency, throughput, and failure-mode assumptions to be stated.
- Expect trade-offs between consistency, availability, cost, complexity, and time-to-ship.
- Expect discussion of observability, deployment, and operational ownership — not only code structure.
- Expect stack choices to be justified by constraints, not name-dropping.`;
    case 'qa_quality':
      return `# Role Adaptation
Focus on quality engineering: test strategy, risk-based prioritization, defect communication, release judgment, automation ROI, and collaboration with dev/product.

# QA/Testing Core Expectations
- Expect risk-based thinking instead of "test everything".
- Expect clear test pyramid / coverage strategy tied to business risk.
- Expect structured bug reports with severity, impact, reproduction, and evidence.
- Expect ability to balance manual exploration, regression, and automation.
- Expect quality metrics and release criteria, not vague "high quality".`;
    case 'sales_commercial':
      return `# Role Adaptation
Focus on commercial excellence: discovery, qualification, objection handling, closing, pipeline management, and revenue accountability.

# Sales/Commercial Core Expectations
- Expect discovery before pitching — pain, budget, authority, timeline, and fit.
- Expect structured call flow, not feature-dumping.
- Expect pipeline metrics: conversion, quota, deal size, cycle length, win rate.
- Expect objection handling with empathy and evidence, not discounting by default.
- Expect CRM/process discipline and ability to narrate won/lost deals with numbers.`;
    case 'operations_delivery':
      return `# Role Adaptation
Focus on delivery excellence: planning, dependencies, risk management, prioritization, process design, stakeholder alignment, and execution discipline.

# Operations/Delivery Core Expectations
- Expect clear scope, timeline, and dependency mapping before action.
- Expect risk identification with mitigation and escalation paths.
- Expect prioritization when deadlines slip — what moves, what is descoped, who decides.
- Expect stakeholder communication cadence and transparent status reporting.
- Expect retrospective thinking and process improvement with measurable outcomes.`;
    case 'design_ux':
      return `# Role Adaptation
Focus on user-centered design: research quality, problem framing, usability, interaction design, handoff, and measurable UX outcomes.

# Design/UX Core Expectations
- Expect user/problem clarity before visual or UI solutions.
- Expect research or evidence behind design decisions — not taste alone.
- Expect discussion of usability, edge cases, accessibility, and trade-offs.
- Expect collaboration with product/engineering and clear handoff criteria.
- Expect UX success metrics: task success, conversion, time-on-task, satisfaction, or adoption.`;
    case 'leadership_behavioral':
      return `# Role Adaptation
Focus on influence and leadership: ownership, ambiguity, difficult trade-offs, stakeholder conflict, delegation, coaching, and decision quality.

# Leadership/Behavioral Core Expectations
- Expect personal ownership and decision-making, not vague “we decided”.
- Expect influence without authority and conflict resolution with specifics.
- Expect delegation, coaching, and team outcomes — not heroics only.
- Expect judgment under ambiguity with explicit trade-offs.
- Expect measurable org/team impact: retention, velocity, quality, revenue, or morale signals.`;
    case 'marketing_growth':
      return `# Role Adaptation
Focus on marketing performance: funnel thinking, channel strategy, creative vs data balance, experimentation, attribution, and ROI.

# Marketing/Growth Core Expectations
- Expect clear funnel stages, target audience, and success metrics per channel.
- Expect hypothesis-driven campaigns, not activity for activity's sake.
- Expect budget/ROI and trade-offs between reach, CAC, LTV, and brand.
- Expect measurement plan and attribution realism.
- Expect collaboration with product, sales, and creative with clear ownership.`;
    case 'customer_success':
      return `# Role Adaptation
Focus on customer outcomes: onboarding, adoption, health, churn prevention, expansion, and voice-of-customer influence.

# Customer Success Core Expectations
- Expect customer-centric problem framing and proactive risk detection.
- Expect health score / leading indicators thinking, not reactive firefighting only.
- Expect escalation judgment and cross-functional influence on product/process.
- Expect retention and expansion metrics, not vague “happy customers”.
- Expect structured communication with accounts and internal stakeholders.`;
    case 'hr_people':
      return `# Role Adaptation
Focus on people operations and talent: sourcing, assessment, stakeholder management, employer brand, compliance awareness, and hiring quality.

# HR/People Core Expectations
- Expect structured hiring process thinking: role calibration, sourcing, assessment, closing.
- Expect candidate experience and employer brand considerations.
- Expect data-informed recruiting (pipeline, conversion, time-to-hire) where relevant.
- Expect partnership with hiring managers and conflict navigation.
- Expect ethical, compliant, and inclusive hiring judgment.`;
    default:
      return `# Role Adaptation
Use universal interview standards: clear reasoning, prioritization, evidence, communication, and decision-making under constraints.`;
  }
}

export function buildModePrompt(mode: InterviewPrepMode): string {
  switch (mode) {
    case 'diagnostics':
      return `# Mode Protocol: Diagnostics
- Run a concise structured intake.
- Ask exactly ONE focused question per turn — never a list of questions.
- Map weak spots, role-fit gaps, and confidence level.
- Do not conclude until the system requests a gap map Pack.`;
    case 'theory':
      return `# Mode Protocol: Theory
- In learn phase: explain as a teacher (definition -> intuition -> usage -> mistakes -> cheat sheet).
- In check phase: one mini-check question only.
- Keep it practical and interview-oriented.`;
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
  switch (inferRoleTrack(profile)) {
    case 'analytics_data':
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
      break;
    case 'engineering_systems':
      switch (mode) {
        case 'diagnostics':
          return `# Engineering/Systems Role Pack: Diagnostics
- Map the candidate across fundamentals, system design, debugging, reliability, code quality, ownership, and communication under technical ambiguity.
- Identify whether the candidate is stronger in implementation, architecture, or operations/SRE signals.
- Ask for concrete examples of shipped systems, incidents, or technical trade-offs — not only stack lists.`;
        case 'theory':
          return `# Engineering/Systems Role Pack: Theory
- Default to engineering-relevant explanations: SOLID, patterns, concurrency, databases, caching, queues, API design, observability, CAP, consistency models, and common anti-patterns.
- Tie theory to interview answers: when to use what, and what breaks at scale.`;
        case 'case':
          return `# Engineering/Systems Role Pack: Case
- Treat cases as system design, debugging, or architecture exercises.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify requirements and scale assumptions
  2. define API/contracts and data model
  3. propose high-level architecture
  4. identify bottlenecks and failure modes
  5. discuss trade-offs (consistency, latency, cost, complexity)
  6. cover observability, rollout, and operational concerns
  7. summarize risks and next iteration
- Penalize technology name-dropping without constraints, missing scale assumptions, and no failure-mode thinking.`;
        case 'mock':
          return `# Engineering/Systems Role Pack: Mock Interview
- Use realistic engineering interview pressure: system design, deep-dive on stack from vacancy, debugging scenarios, incident postmortems, and technical trade-offs.
- If the answer is shallow, probe with “what scale?”, “what fails first?”, “why this over alternatives?”, “how would you observe and debug this?”`;
        case 'star':
          return `# Engineering/Systems Role Pack: STAR
- Push on technical ownership, complexity handled, measurable impact, and judgment under constraints.
- Distinguish between “I participated” and “I owned the design/fix/release”.
- Require specifics: scale, latency, defect reduction, uptime, delivery speed, or tech-debt trade-off.`;
        case 'employer_questions':
          return `# Engineering/Systems Role Pack: Employer Questions
- Favor questions about architecture ownership, on-call/incident culture, code review standards, deployment frequency, technical debt policy, and success metrics for the team.`;
      }
      break;
    case 'qa_quality':
      switch (mode) {
        case 'diagnostics':
          return `# QA/Testing Role Pack: Diagnostics
- Map the candidate across test strategy, risk prioritization, defect communication, automation judgment, release quality, and collaboration with dev/product.
- Identify whether the candidate is stronger in manual exploration, test automation, or quality leadership.
- Ask for examples where testing prevented a bad release or changed team quality practices.`;
        case 'theory':
          return `# QA/Testing Role Pack: Theory
- Default to QA-relevant explanations: test pyramid, risk-based testing, equivalence partitioning, boundary values, regression strategy, severity/priority, flaky tests, CI/CD gates, and automation ROI.
- Contrast “test everything” answers with risk-focused quality engineering.`;
        case 'case':
          return `# QA/Testing Role Pack: Case
- Treat cases as test strategy, release risk, or quality trade-off exercises.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify feature scope, users, and release constraints
  2. identify highest-risk areas and assumptions
  3. choose test types and coverage strategy
  4. define environments, data, and automation scope
  5. set entry/exit criteria and release recommendation
  6. discuss trade-offs (speed vs coverage, manual vs auto)
  7. explain monitoring and post-release validation
- Penalize vague “I will test everything”, missing risk prioritization, and no release criteria.`;
        case 'mock':
          return `# QA/Testing Role Pack: Mock Interview
- Use realistic QA interview pressure: test plan for ambiguous feature, release under time pressure, flaky automation, QA-dev conflict, and production defect scenarios.
- If the answer is shallow, probe with “what is highest risk?”, “what would you skip and why?”, “how do you decide go/no-go?”, “how would you communicate this defect?”`;
        case 'star':
          return `# QA/Testing Role Pack: STAR
- Push on quality ownership, critical defect caught, influence on release decision, and automation or process improvement with measurable outcome.
- Distinguish between “I found bugs” and “I changed quality outcomes for the team”.
- Require impact: defects prevented, escaped defects reduced, cycle time, coverage, or release confidence.`;
        case 'employer_questions':
          return `# QA/Testing Role Pack: Employer Questions
- Favor questions about release process, definition of done, automation maturity, bug triage, on-call/production quality ownership, and how QA influences roadmap risk.`;
      }
      break;
    case 'product_business':
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
      break;
    case 'sales_commercial':
      switch (mode) {
        case 'diagnostics':
          return `# Sales/Commercial Role Pack: Diagnostics
- Map the candidate across discovery skill, qualification rigor, objection handling, closing confidence, pipeline discipline, and communication under pressure.
- Identify whether the candidate is stronger in hunting, farming, or full-cycle selling.
- Ask for concrete deal examples with numbers, not only activity metrics.`;
        case 'theory':
          return `# Sales/Commercial Role Pack: Theory
- Default to sales-relevant explanations: ICP, discovery questions, BANT/MEDDIC lite, objection frameworks, pipeline stages, forecasting, quota math, and CRM hygiene.
- Contrast feature-dumping with consultative selling whenever possible.`;
        case 'case':
          return `# Sales/Commercial Role Pack: Case
- Treat cases as live selling exercises: cold outreach, discovery call, objection handling, upsell, or lost-deal recovery.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify buyer context and goal of the conversation
  2. ask discovery questions before pitching
  3. qualify fit, budget, authority, and timeline
  4. position value tied to buyer pain, not features
  5. handle the main objection with empathy and proof
  6. propose a concrete next step or close
  7. name pipeline impact and how you would track it
- Penalize pitching without discovery, missing numbers, and weak next-step commitment.`;
        case 'mock':
          return `# Sales/Commercial Role Pack: Mock Interview
- Default to role-play: you are the buyer or skeptical decision-maker; the candidate must sell through conversation.
- Use realistic pressure: price objection, competitor mention, stalled deal, or unclear champion.
- If the answer is shallow, probe with “what pain did you uncover?”, “why you vs competitor?”, “what is the next step and by when?”, “how big is the deal?”`;
        case 'star':
          return `# Sales/Commercial Role Pack: STAR
- Push on deal ownership, discovery quality, objection navigation, and measurable revenue outcome.
- Distinguish between “I supported the deal” and “I closed or saved the deal”.
- Require numbers: quota attainment, deal size, cycle time, conversion, retention, or expansion revenue.`;
        case 'employer_questions':
          return `# Sales/Commercial Role Pack: Employer Questions
- Favor questions about ICP clarity, sales motion, quota realism, enablement, CRM discipline, comp plan, manager coaching, and how product/marketing supports pipeline.`;
      }
      break;
    case 'operations_delivery':
      switch (mode) {
        case 'diagnostics':
          return `# Operations/Delivery Role Pack: Diagnostics
- Map the candidate across planning, risk management, dependency handling, stakeholder communication, prioritization, and execution under deadline pressure.
- Identify whether the candidate is stronger in process design, firefighting, or cross-team orchestration.
- Ask for examples of saved or recovered delivery, not only methodology labels.`;
        case 'theory':
          return `# Operations/Delivery Role Pack: Theory
- Default to delivery-relevant explanations: WBS, critical path, RACI, risk register, sprint/release planning, escalation, status reporting, retrospectives, and change control.
- Tie frameworks to interview answers — when each tool helps and when it is overkill.`;
        case 'case':
          return `# Operations/Delivery Role Pack: Case
- Treat cases as delivery crisis or planning exercises: missed deadline, scope creep, blocked dependency, or release risk.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify scope, deadline, stakeholders, and constraints
  2. map dependencies and critical path
  3. identify top risks and assumptions
  4. prioritize recovery actions with owners and dates
  5. decide what to descope, parallelize, or escalate
  6. define communication plan and decision points
  7. explain how you prevent recurrence
- Penalize vague “we worked harder”, missing stakeholders, and no trade-off on scope/time/quality.`;
        case 'mock':
          return `# Operations/Delivery Role Pack: Mock Interview
- Use realistic delivery interview pressure: slipped milestone, conflicting priorities, unavailable dependency, unhappy stakeholder, or go/no-go release call.
- If the answer is shallow, probe with “what slips first?”, “who do you escalate to and when?”, “what do you descope?”, “how do you communicate bad news?”`;
        case 'star':
          return `# Operations/Delivery Role Pack: STAR
- Push on ownership of delivery outcomes, conflict resolution, risk mitigation, and measurable recovery or predictability gains.
- Distinguish between “I reported status” and “I changed the delivery outcome”.
- Require impact: on-time delivery, reduced slippage, cycle time, risk reduction, or stakeholder satisfaction.`;
        case 'employer_questions':
          return `# Operations/Delivery Role Pack: Employer Questions
- Favor questions about planning maturity, decision rights, escalation paths, tooling, release cadence, cross-team dependencies, and how success is measured for delivery roles.`;
      }
      break;
    case 'design_ux':
      switch (mode) {
        case 'diagnostics':
          return `# Design/UX Role Pack: Diagnostics
- Map the candidate across research skill, problem framing, interaction thinking, collaboration, visual/system judgment, and impact measurement.
- Identify whether the candidate is stronger in research, product design, or UI execution.
- Ask for examples where design changed user behavior or business outcomes, not only deliverables.`;
        case 'theory':
          return `# Design/UX Role Pack: Theory
- Default to design-relevant explanations: user research methods, jobs-to-be-done, usability heuristics, information architecture, design systems, prototyping, critique, and UX metrics.
- Contrast aesthetic-only answers with evidence-based design reasoning.`;
        case 'case':
          return `# Design/UX Role Pack: Case
- Treat cases as UX/product design exercises: redesign a flow, improve onboarding, resolve usability issue, or prioritize design debt.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify user, job-to-be-done, and business goal
  2. state assumptions and constraints
  3. identify research or evidence needed
  4. propose design options and rationale
  5. explain usability risks and edge cases
  6. define success metrics and validation plan
  7. describe handoff and iteration approach
- Penalize jumping to UI polish without problem framing, missing metrics, and no validation plan.`;
        case 'mock':
          return `# Design/UX Role Pack: Mock Interview
- Use realistic design interview pressure: critique a flow, defend a design decision, stakeholder pushback, dev constraints, or research ambiguity.
- If the answer is shallow, probe with “what user problem?”, “what evidence?”, “what trade-off?”, “how would you measure success?”`;
        case 'star':
          return `# Design/UX Role Pack: STAR
- Push on design ownership, user impact, research/evidence used, and measurable outcome.
- Distinguish between “I made mockups” and “I changed the user outcome”.
- Require metrics: conversion, task success, NPS, support tickets, time-on-task, or adoption.`;
        case 'employer_questions':
          return `# Design/UX Role Pack: Employer Questions
- Favor questions about research maturity, design-dev handoff, design system, decision rights, UX metrics ownership, and how design influences roadmap.`;
      }
      break;
    case 'leadership_behavioral':
      switch (mode) {
        case 'diagnostics':
          return `# Leadership/Behavioral Role Pack: Diagnostics
- Map the candidate across ownership, influence, conflict handling, delegation, hiring/mentoring, strategic judgment, and communication under ambiguity.
- Identify whether the candidate is stronger as people leader, org operator, or hands-on lead.
- Ask for examples of hard decisions, team outcomes, and cross-functional influence — not only titles.`;
        case 'theory':
          return `# Leadership/Behavioral Role Pack: Theory
- Default to leadership-relevant explanations: situational leadership, delegation, feedback, conflict resolution, stakeholder management, hiring bar, prioritization under uncertainty, and org design basics.
- Tie frameworks to behavioral interview answers with concrete examples.`;
        case 'case':
          return `# Leadership/Behavioral Role Pack: Case
- Treat cases as leadership judgment exercises: underperforming team member, conflicting priorities, failed initiative, org change, or stakeholder escalation.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify context, stakeholders, and stakes
  2. diagnose root cause (people, process, strategy, alignment)
  3. state options and trade-offs
  4. choose a decision with rationale
  5. explain communication and delegation plan
  6. define success metrics and timeline
  7. reflect on risks and what you would monitor
- Penalize vague “I would talk to people” without decision, trade-offs, or follow-through.`;
        case 'mock':
          return `# Leadership/Behavioral Role Pack: Mock Interview
- Use realistic leadership interview pressure: behavioral deep-dives, conflict scenarios, failed project accountability, hiring judgment, and strategy under ambiguity.
- STAR and situational questions dominate; probe ownership, influence, and measurable team/org impact.
- If the answer is shallow, probe with “what did YOU decide?”, “who disagreed?”, “what was the measurable outcome?”, “what would you do differently?”`;
        case 'star':
          return `# Leadership/Behavioral Role Pack: STAR
- Push on personal ownership, influence without authority, conflict navigation, and measurable team/org result.
- Distinguish between “I was on the team” and “I owned the outcome”.
- Require impact: team performance, retention, delivery, quality, revenue, cost, or stakeholder alignment.`;
        case 'employer_questions':
          return `# Leadership/Behavioral Role Pack: Employer Questions
- Favor questions about decision rights, team topology, performance culture, hiring bar, strategic priorities, executive alignment, and how success is measured for leaders.`;
      }
      break;
    case 'marketing_growth':
      switch (mode) {
        case 'diagnostics':
          return `# Marketing/Growth Role Pack: Diagnostics
- Map the candidate across funnel thinking, channel expertise, experimentation, analytics/attribution, creative judgment, and ROI mindset.
- Identify whether the candidate is stronger in performance, brand, content, or CRM/lifecycle.
- Ask for campaign examples with metrics, not only channel lists.`;
        case 'theory':
          return `# Marketing/Growth Role Pack: Theory
- Default to marketing explanations: funnel, CAC/LTV, attribution, A/B testing, cohorts, creatives, positioning, messaging, channel mix, and budget allocation.
- Contrast vanity metrics with business-impact metrics.`;
        case 'case':
          return `# Marketing/Growth Role Pack: Case
- Treat cases as campaign or growth planning exercises: launch plan, budget cut, underperforming channel, or repositioning.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify business goal and audience
  2. define funnel stage and primary metric
  3. state hypotheses and channel options
  4. estimate budget/resources and trade-offs
  5. design experiment or rollout plan
  6. define measurement and attribution approach
  7. explain risks and iteration plan
- Penalize channel dumping without metrics, missing attribution caveats, and no ROI logic.`;
        case 'mock':
          return `# Marketing/Growth Role Pack: Mock Interview
- Use realistic marketing interview pressure: defend channel choice, explain failed campaign, budget trade-offs, stakeholder disagreement, or attribution ambiguity.
- If the answer is shallow, probe with “what metric?”, “what baseline?”, “why this channel?”, “how would you prove impact?”`;
        case 'star':
          return `# Marketing/Growth Role Pack: STAR
- Push on campaign ownership, experiment design, and measurable business impact.
- Require metrics: CAC, ROAS, conversion, retention, pipeline, revenue, or brand lift proxy.
- Distinguish between “I ran ads” and “I improved measurable outcomes”.`;
        case 'employer_questions':
          return `# Marketing/Growth Role Pack: Employer Questions
- Favor questions about attribution maturity, budget ownership, experimentation culture, brand vs performance balance, tooling, and how marketing success is measured.`;
      }
      break;
    case 'customer_success':
      switch (mode) {
        case 'diagnostics':
          return `# Customer Success Role Pack: Diagnostics
- Map the candidate across onboarding, adoption, health/risk detection, churn prevention, expansion, escalation, and cross-functional influence.
- Identify whether the candidate is stronger in high-touch, scaled/digital CS, or support leadership.
- Ask for examples where they saved or grew an account with metrics.`;
        case 'theory':
          return `# Customer Success Role Pack: Theory
- Default to CS explanations: onboarding, health score, leading indicators, churn drivers, QBRs, playbooks, escalation paths, expansion motions, and voice-of-customer loops.
- Contrast reactive support with proactive success management.`;
        case 'case':
          return `# Customer Success Role Pack: Case
- Treat cases as account risk or lifecycle exercises: churn risk, failed onboarding, escalation, expansion opportunity, or portfolio prioritization.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify account context, segment, and business impact
  2. identify risk signals and root cause
  3. prioritize actions and owners
  4. define customer communication plan
  5. involve product/support/sales as needed
  6. set success metrics and timeline
  7. explain prevention/expansion follow-up
- Penalize vague “I would check in” without diagnosis, prioritization, or metrics.`;
        case 'mock':
          return `# Customer Success Role Pack: Mock Interview
- Use realistic CS interview pressure: angry enterprise client, renewal at risk, adoption failure, or conflicting internal priorities.
- STAR-heavy for saved accounts; probe influence, escalation, and measurable retention/expansion impact.`;
        case 'star':
          return `# Customer Success Role Pack: STAR
- Push on ownership of customer outcomes, escalation judgment, and measurable retention/expansion results.
- Require metrics: churn prevented, NRR, adoption, health score, expansion revenue, or CSAT/NPS movement.`;
        case 'employer_questions':
          return `# Customer Success Role Pack: Employer Questions
- Favor questions about segment model, health metrics, escalation, product feedback loop, renewal ownership, and how CS success is measured.`;
      }
      break;
    case 'hr_people':
      switch (mode) {
        case 'diagnostics':
          return `# HR/People Role Pack: Diagnostics
- Map the candidate across sourcing, assessment quality, stakeholder management, closing skill, employer brand, and process discipline.
- Identify whether the candidate is stronger in recruiting, HR BP, or talent operations.
- Ask for examples of hard-to-fill roles or hiring process improvements with outcomes.`;
        case 'theory':
          return `# HR/People Role Pack: Theory
- Default to HR/recruiting explanations: sourcing channels, structured interviews, scorecards, pipeline metrics, candidate experience, compliance basics, and employer branding.
- Tie theory to practical hiring decisions and trade-offs.`;
        case 'case':
          return `# HR/People Role Pack: Case
- Treat cases as hiring or people-process exercises: close a hard vacancy, fix broken pipeline, hiring manager conflict, or offer negotiation risk.
- Prefer this skeleton unless the case clearly needs another one:
  1. clarify role requirements and success profile
  2. diagnose hiring bottleneck (sourcing, assessment, offer, brand)
  3. propose sourcing and assessment plan
  4. align with hiring manager and set timeline
  5. define pipeline metrics and checkpoints
  6. handle risks (diversity, compliance, candidate experience)
  7. explain how you would measure success
- Penalize generic “post on job boards” without calibration, metrics, or stakeholder plan.`;
        case 'mock':
          return `# HR/People Role Pack: Mock Interview
- Use realistic HR/recruiting interview pressure: behavioral questions on difficult hires, stakeholder pushback, process design, and ethical dilemmas.
- If shallow, probe with “how did you calibrate the role?”, “what was conversion?”, “how did you handle rejection/offer risk?”`;
        case 'star':
          return `# HR/People Role Pack: STAR
- Push on ownership of hiring outcomes, influence on hiring managers, and measurable pipeline improvements.
- Require metrics: time-to-hire, offer acceptance, quality of hire proxy, diversity pipeline, or roles closed under constraints.`;
        case 'employer_questions':
          return `# HR/People Role Pack: Employer Questions
- Favor questions about hiring bar, process maturity, tooling, manager partnership, employer brand investment, and how recruiting/HR success is measured.`;
      }
      break;
    default:
      return null;
  }
  return null;
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
- Use a conversational tone.
- STRICTLY FORBIDDEN: Do not use markdown headers (like ###) or long bulleted lists.
- Prefer practical explanation over textbook wording.
- End with a short mini-check question.`;
    default:
      return `# Output Format
- Use structured, concise paragraphs.
- STRICTLY FORBIDDEN: Do not use markdown headers (like ###) or bulleted lists.
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
  switch (inferRoleTrack(profile)) {
    case 'analytics_data': {
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
    case 'engineering_systems': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For engineering case/mock answers, heavily reward requirements clarity, scale assumptions, architecture reasoning, failure-mode analysis, and justified trade-offs.'
          : mode === 'star'
            ? '- For engineering STAR stories, heavily reward technical ownership, complexity handled, measurable system impact, and sound judgment under constraints.'
            : '- For engineering answers, evaluate systems thinking, depth on fundamentals, and operational realism.';

      return `# Engineering/Systems Role Pack Rubric
- Penalize answers that list technologies without explaining why they fit the constraints.
- Penalize missing scale assumptions, missing failure modes, and hand-wavy “we will scale later”.
- Penalize designs with no observability, rollout, or maintenance plan.
- Reward explicit trade-offs, bottleneck analysis, and ownership of production outcomes.
- Reward clear communication of technical decisions to non-experts when relevant.
${modeSpecific}`;
    }
    case 'qa_quality': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For QA case/mock answers, heavily reward risk-based prioritization, clear test strategy, release criteria, and realistic automation scope.'
          : mode === 'star'
            ? '- For QA STAR stories, heavily reward quality ownership, influence on release decisions, and measurable quality improvements.'
            : '- For QA answers, evaluate test strategy quality, defect communication, and release judgment.';

      return `# QA/Testing Role Pack Rubric
- Penalize “test everything” answers with no risk prioritization.
- Penalize vague bug talk without severity, impact, reproduction, or stakeholder communication.
- Penalize automation enthusiasm without ROI, maintainability, or flakiness awareness.
- Reward risk-based coverage, clear go/no-go criteria, and collaboration with dev/product.
- Reward quality metrics and examples of prevented production issues.
${modeSpecific}`;
    }
    case 'product_business': {
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
    case 'sales_commercial': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For sales case/mock answers, heavily reward discovery quality, qualification rigor, objection handling, confident next steps, and pipeline/revenue metrics.'
          : mode === 'star'
            ? '- For sales STAR stories, heavily reward deal ownership, measurable revenue impact, and evidence of consultative selling.'
            : '- For sales answers, evaluate structure of the conversation, buyer empathy, and commercial judgment.';

      return `# Sales/Commercial Role Pack Rubric
- Penalize feature-dumping before understanding buyer pain and fit.
- Penalize answers with no numbers: deal size, quota, conversion, cycle time, or outcome.
- Penalize weak next steps and passive “I would follow up sometime” language.
- Reward discovery-led selling, crisp objection handling, and confident closing or advance.
- Reward CRM/process discipline and honest lost-deal reflection.
${modeSpecific}`;
    }
    case 'operations_delivery': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For operations case/mock answers, heavily reward dependency mapping, risk mitigation, prioritization under constraints, escalation judgment, and stakeholder communication.'
          : mode === 'star'
            ? '- For operations STAR stories, heavily reward delivery ownership, conflict handling, and measurable predictability or recovery impact.'
            : '- For operations answers, evaluate planning quality, execution discipline, and stakeholder management.';

      return `# Operations/Delivery Role Pack Rubric
- Penalize answers that ignore dependencies, risks, or stakeholder alignment.
- Penalize heroic overtime narratives without scope/priority trade-offs.
- Penalize status reporting without decisions or recovery actions.
- Reward clear plans, explicit trade-offs on scope/time/quality, and escalation when needed.
- Reward retrospective learning and process improvements with measurable results.
${modeSpecific}`;
    }
    case 'design_ux': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For design case/mock answers, heavily reward user problem framing, evidence/research, usability reasoning, trade-offs, and measurable UX impact.'
          : mode === 'star'
            ? '- For design STAR stories, heavily reward design ownership, validation, collaboration, and user/business outcome metrics.'
            : '- For design answers, evaluate user-centered thinking and decision quality.';

      return `# Design/UX Role Pack Rubric
- Penalize aesthetic-only answers without user problem or evidence.
- Penalize missing usability edge cases, accessibility, or handoff considerations.
- Penalize designs with no success metrics or validation plan.
- Reward clear research logic, option comparison, and iteration mindset.
- Reward collaboration with product/engineering and outcome measurement.
${modeSpecific}`;
    }
    case 'leadership_behavioral': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For leadership case/mock answers, heavily reward ownership, influence, conflict handling, delegation, and measurable team/org outcomes.'
          : mode === 'star'
            ? '- For leadership STAR stories, heavily reward decision quality, stakeholder navigation, and quantified impact on people or business.'
            : '- For leadership answers, evaluate judgment, ownership, and influence.';

      return `# Leadership/Behavioral Role Pack Rubric
- Penalize “we” answers with no personal decision or action.
- Penalize conflict avoidance narratives with no resolution or trade-off.
- Penalize leadership talk without team/org metrics or outcomes.
- Reward explicit decisions, stakeholder management, and coaching/delegation examples.
- Reward reflection, accountability, and learning from failure.
${modeSpecific}`;
    }
    case 'marketing_growth': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For marketing case/mock answers, heavily reward funnel logic, metric choice, channel trade-offs, experiment design, and ROI/attribution realism.'
          : mode === 'star'
            ? '- For marketing STAR stories, heavily reward campaign ownership and measurable growth or efficiency impact.'
            : '- For marketing answers, evaluate strategic channel thinking and measurement discipline.';

      return `# Marketing/Growth Role Pack Rubric
- Penalize channel lists without audience, metric, or ROI logic.
- Penalize vanity metrics and missing attribution caveats.
- Penalize campaigns with no experiment or iteration plan.
- Reward hypothesis-driven planning and budget trade-offs.
- Reward clear business impact metrics (CAC, LTV, conversion, pipeline, revenue).
${modeSpecific}`;
    }
    case 'customer_success': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For CS case/mock answers, heavily reward risk diagnosis, prioritization, escalation, stakeholder coordination, and retention/expansion metrics.'
          : mode === 'star'
            ? '- For CS STAR stories, heavily reward account ownership and measurable customer outcomes.'
            : '- For CS answers, evaluate proactive customer judgment and communication quality.';

      return `# Customer Success Role Pack Rubric
- Penalize reactive “check in” answers without risk diagnosis or plan.
- Penalize missing metrics for retention, adoption, health, or expansion.
- Penalize weak escalation and internal influence narratives.
- Reward structured playbooks, customer communication, and cross-functional action.
- Reward measurable saved accounts or growth outcomes.
${modeSpecific}`;
    }
    case 'hr_people': {
      const modeSpecific =
        mode === 'case' || mode === 'mock'
          ? '- For HR/recruiting case/mock answers, heavily reward role calibration, sourcing strategy, assessment quality, stakeholder alignment, and pipeline metrics.'
          : mode === 'star'
            ? '- For HR STAR stories, heavily reward hiring outcome ownership and process improvement impact.'
            : '- For HR answers, evaluate structured hiring judgment and partnership with managers.';

      return `# HR/People Role Pack Rubric
- Penalize generic sourcing advice without calibration or metrics.
- Penalize ignoring candidate experience, compliance, or inclusivity.
- Penalize weak hiring manager partnership and conflict handling.
- Reward structured process design and data-informed recruiting.
- Reward measurable hiring outcomes (time-to-hire, acceptance rate, quality signals).
${modeSpecific}`;
    }
    default:
      return null;
  }
}

export function buildInterviewSystemMessage(
  mode?: InterviewPrepMode,
  profile?: PromptVacancyProfile,
  candidateSeniority?: string
): AIMessage {
  const extraSections = [
    buildInterviewCorePersona(mode),
    buildLanguageInstruction(profile),
    buildAntiWaterRules(),
    buildRoleAdaptationPrompt(profile),
    buildSeniorityIntensityPrompt(profile, candidateSeniority),
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

export function buildPrepPlanSeniorityBlock(
  profile?: PromptVacancyProfile,
  explicitSeniority?: string
): string {
  switch (resolveInterviewSeniority(profile, explicitSeniority)) {
    case 'junior':
      return `# 5-Day Plan Adjustments (Junior)
- Days 1–2: heavier LEARN; narrow-scope cases; mock on day 5 with mandatory briefing.
- More theory tasks; fewer simultaneous apply items per day.`;
    case 'middle':
      return `# 5-Day Plan Adjustments (Middle)
- Use the standard 5-day LAR template from methodology.`;
    case 'senior':
      return `# 5-Day Plan Adjustments (Senior)
- Less theory, more case + mock earlier if readiness allows.
- Diagnostics and apply should stress trade-offs and judgment, not basics.`;
    case 'lead':
      return `# 5-Day Plan Adjustments (Lead)
- Emphasize STAR (influence, conflict, org impact) and strategic cases.
- Pack day should include executive-level employer questions.`;
    default:
      return '';
  }
}

export function buildPrepPlanPrompt(params: {
  vacancyProfile: PromptVacancyProfile;
  availableDays: number;
  candidateSeniority?: string;
  prepContext?: {
    priorFatalGaps?: string[];
    prepSessionNumber?: number;
    sameRoleTrack?: boolean;
  };
}): AIMessage {
  const retentionBlock = params.prepContext?.prepSessionNumber
    ? `
Returning candidate context:
- This is preparation session #${params.prepContext.prepSessionNumber} for this user.
- Same role track as before: ${params.prepContext.sameRoleTrack ? 'yes' : 'no'}.
${
  params.prepContext.priorFatalGaps?.length
    ? `- Prior fatal gaps to address early in the plan:\n${params.prepContext.priorFatalGaps.map((gap) => `  - ${gap}`).join('\n')}`
    : '- No prior fatal gaps recorded.'
}
- Prioritize closing recurring gaps; skip basics if sameRoleTrack is true.`
    : '';

  const seniorityBlock = buildPrepPlanSeniorityBlock(
    params.vacancyProfile,
    params.candidateSeniority
  );

  return buildUserMessage(`Create a practical interview prep plan for ${params.availableDays} days.

Vacancy profile:
${normalizeProfileText(params.vacancyProfile)}
${retentionBlock}
${seniorityBlock ? `\n${seniorityBlock}` : ''}

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
- Act as a live coach in a real conversation.
- STRICTLY FORBIDDEN: Do not use markdown headers (like ###) or long bulleted lists. Your response must look like a normal chat message.
- Keep your answer concise (under 600-800 characters).
- If grading exists, use it directly: diagnose the weakness briefly, explain the gap, propose a better answer structure, and then ALWAYS ask exactly one precise follow-up question.
- If grading does not exist and the mode is case/mock, present exactly one task or question and stop.
- Do not become generic, motivational, or verbose.
${resolveInterviewLanguage(params.vacancyProfile) === 'ru' ? '- Respond in Russian.' : '- Respond in English.'}
${isPmRolePack(params.vacancyProfile) ? '- PM/Product role pack is active: explicitly check product sense, metrics, prioritization, experimentation, and stakeholder trade-offs.' : ''}
${isAnalyticsRolePack(params.vacancyProfile) ? '- Analytics/Data role pack is active: explicitly check hypothesis quality, metric definitions, causality vs correlation, experiment design, and uncertainty handling.' : ''}
${isEngineeringRolePack(params.vacancyProfile) ? '- Engineering/Systems role pack is active: explicitly check requirements clarity, scale assumptions, architecture trade-offs, failure modes, and operational ownership.' : ''}
${isQaRolePack(params.vacancyProfile) ? '- QA/Testing role pack is active: explicitly check risk-based test strategy, release criteria, defect communication, and automation judgment.' : ''}
${isSalesRolePack(params.vacancyProfile) ? '- Sales/Commercial role pack is active: explicitly check discovery before pitching, qualification, objection handling, next-step commitment, and revenue/pipeline numbers.' : ''}
${isOperationsRolePack(params.vacancyProfile) ? '- Operations/Delivery role pack is active: explicitly check planning, dependencies, risk mitigation, prioritization under deadline pressure, and stakeholder communication.' : ''}
${isDesignRolePack(params.vacancyProfile) ? '- Design/UX role pack is active: explicitly check user problem framing, research/evidence, usability trade-offs, handoff, and UX metrics.' : ''}
${isLeadershipRolePack(params.vacancyProfile) ? '- Leadership/Behavioral role pack is active: explicitly check ownership, influence, conflict handling, delegation, and measurable team/org impact.' : ''}
${isMarketingRolePack(params.vacancyProfile) ? '- Marketing/Growth role pack is active: explicitly check funnel metrics, channel trade-offs, experiment/attribution logic, and ROI.' : ''}
${isCustomerSuccessRolePack(params.vacancyProfile) ? '- Customer Success role pack is active: explicitly check health/risk diagnosis, escalation, retention/expansion metrics, and customer communication.' : ''}
${isHrRolePack(params.vacancyProfile) ? '- HR/People role pack is active: explicitly check role calibration, sourcing/assessment quality, pipeline metrics, and hiring manager partnership.' : ''}
${params.shortenedDiagnostics && params.mode === 'diagnostics' ? '- Shortened diagnostics: this is a returning candidate in the same role track — ask fewer intake questions (about 2 focused probes) before the gap map.' : ''}
${params.mode === 'star' && params.starBank?.length ? `- STAR bank available (${params.starBank.length} stories). Offer to adapt a prior story to the new role when relevant; reference bank:\n${JSON.stringify(params.starBank.slice(0, 4), null, 2)}` : ''}`);
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
${isAnalyticsRolePack(params.vacancyProfile) ? '- Analytics/Data role pack is active: check whether the answer shows analytical rigor rather than generic metric talk.' : ''}
${isEngineeringRolePack(params.vacancyProfile) ? '- Engineering/Systems role pack is active: check whether the answer shows systems thinking and justified technical trade-offs rather than stack name-dropping.' : ''}
${isQaRolePack(params.vacancyProfile) ? '- QA/Testing role pack is active: check whether the answer shows risk-based quality engineering rather than vague “I will test everything”.' : ''}
${isSalesRolePack(params.vacancyProfile) ? '- Sales/Commercial role pack is active: check whether the answer shows consultative selling and measurable deal impact rather than feature-dumping.' : ''}
${isOperationsRolePack(params.vacancyProfile) ? '- Operations/Delivery role pack is active: check whether the answer shows delivery judgment and trade-offs rather than generic process talk.' : ''}
${isDesignRolePack(params.vacancyProfile) ? '- Design/UX role pack is active: check whether the answer shows user-centered design judgment rather than visual taste only.' : ''}
${isLeadershipRolePack(params.vacancyProfile) ? '- Leadership/Behavioral role pack is active: check whether the answer shows personal ownership and leadership impact rather than generic “we” stories.' : ''}
${isMarketingRolePack(params.vacancyProfile) ? '- Marketing/Growth role pack is active: check whether the answer shows measurable growth thinking rather than channel buzzwords.' : ''}
${isCustomerSuccessRolePack(params.vacancyProfile) ? '- Customer Success role pack is active: check whether the answer shows proactive account judgment rather than generic support talk.' : ''}
${isHrRolePack(params.vacancyProfile) ? '- HR/People role pack is active: check whether the answer shows structured hiring judgment rather than generic recruiting clichés.' : ''}`);
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
