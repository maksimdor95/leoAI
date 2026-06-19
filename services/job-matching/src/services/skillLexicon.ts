import { RoleFamily, classifyProfileRoles } from './roleFamily';

/** Базовые навыки — IT / продукт / аналитика (ядро каталога). */
const CORE_SKILLS = [
  'sql', 'python', 'java', 'javascript', 'typescript', 'go', 'golang', 'rust',
  'react', 'vue', 'angular', 'node.js', 'nodejs', 'docker', 'kubernetes', 'k8s',
  'aws', 'gcp', 'azure', 'postgresql', 'mysql', 'mongodb', 'redis', 'kafka',
  'tableau', 'power bi', 'powerbi', 'excel', 'pandas', 'figma', 'jira', 'confluence',
  'miro', 'notion', 'agile', 'scrum', 'kanban', 'bpmn', 'uml', 'api',
  'machine learning', 'ml', 'a/b', 'a/b-тестирование', 'product management',
  'product owner', 'project management', '1c', '1с', 'sap', 'crm', 'erp', 'bi',
  'amocrm', 'битрикс24', 'bitrix24', 'hubspot', 'salesforce',
] as const;

const SKILLS_BY_FAMILY: Partial<Record<RoleFamily, readonly string[]>> = {
  sales: [
    'spin', 'bant', 'meddic', 'challenger sale', 'cold calling', 'outbound',
    'inbound', 'upsell', 'cross-sell', 'full cycle', 'b2b', 'b2c', 'saas',
    'account executive', 'sdr', 'bdr', 'ключевые клиенты', 'активные продажи',
    'холодные звонки', 'переговоры', 'дожим', 'воронка продаж', 'лидогенерация',
  ],
  marketing: [
    'performance marketing', 'growth', 'seo', 'sem', 'contextual', 'таргет',
    'facebook ads', 'google ads', 'яндекс директ', 'контент-маркетинг', 'smm',
    'brand', 'crm marketing', 'email marketing', 'retention', 'cac', 'ltv',
  ],
  hr: [
    'talent acquisition', 'onboarding', 'hrbp', 'people partner', 'рекрутинг',
    'assessment', 'compensation', 'c&b', 'l&d', 'performance review', 'eNPS',
    '1:1', 'кадровое делопроизводство', 'трудовое право',
  ],
  wellbeing: [
    'кпт', 'act', 'коучинг', 'фасилитация', 'медиация', 'eap', 'well-being',
    'wellbeing', 'mental health', 'психологическая поддержка', 'стресс-менеджмент',
    'mbti', 'hogan', 'gallup', 'опросы вовлеченности', 'employee experience',
  ],
  finance: [
    'ifrs', 'рсбу', 'бюджетирование', 'финмодель', 'cash flow', 'p&l', 'dcf',
    'финансовая отчетность', 'казначейство', 'аудит',
  ],
  design: [
    'figma', 'sketch', 'photoshop', 'illustrator', 'ux research', 'ui kit',
    'design system', 'прототипирование', 'usability',
  ],
  qa: [
    'playwright', 'selenium', 'postman', 'автотесты', 'регресс', 'test case',
    'api testing', 'нагрузочное тестирование',
  ],
};

export function skillsForFamilies(families: RoleFamily[]): string[] {
  const seen = new Set<string>();
  const add = (skill: string) => {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
    }
  };

  for (const skill of CORE_SKILLS) add(skill);
  for (const family of families) {
    const list = SKILLS_BY_FAMILY[family];
    if (list) {
      for (const skill of list) add(skill);
    }
  }

  return Array.from(seen.keys());
}

export function skillsForProfileText(params: {
  desiredRole?: string | null;
  careerSummary?: string | null;
  positionRoles?: string[];
}): string[] {
  const classification = classifyProfileRoles({
    desiredRole: params.desiredRole,
    careerSummary: params.careerSummary,
    positionRoles: params.positionRoles,
  });
  const families: RoleFamily[] = [
    classification.primary,
    ...classification.adjacent,
    ...classification.detected,
  ].filter((f) => f !== 'unknown');

  const hintText = [params.desiredRole, params.careerSummary, ...(params.positionRoles || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  for (const [family, skills] of Object.entries(SKILLS_BY_FAMILY) as [
    RoleFamily,
    readonly string[] | undefined,
  ][]) {
    if (!skills?.some((skill) => hintText.includes(skill.toLowerCase()))) continue;
    if (!families.includes(family)) families.push(family);
  }

  if (families.length === 0) {
    return skillsForFamilies(['product', 'analytics', 'sales', 'hr', 'wellbeing']);
  }
  return skillsForFamilies(families);
}

export function extractSkillsFromTextWithLexicon(
  text: string,
  lexicon: string[]
): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const skill of lexicon) {
    if (skill.length <= 2) continue;
    if (lower.includes(skill.toLowerCase())) {
      found.push(skill);
    }
  }

  return [...new Set(found.map((s) => s.toLowerCase()))];
}
