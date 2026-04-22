/**
 * Role Family Classifier
 *
 * Классифицирует заголовки вакансий и роли из профиля пользователя
 * в семейства профессий (product / analytics / data / backend / ...).
 *
 * Используется матчером для жёсткого отсечения cross-family шума
 * (например, PM не должен получать в топе «React разработчик» или
 * «QA Engineer») и scraper'ом для подбора релевантных ключевых слов
 * для сбора каталога под конкретного пользователя.
 *
 * Философия:
 *   - сначала ищем сильные сигналы-якоря (фразовые совпадения);
 *   - если якорей нет, пытаемся сработать по отдельным токенам;
 *   - если классифицировать не смогли — возвращаем `unknown` и не штрафуем,
 *     чтобы не резать редкие/нестандартные заголовки необоснованно.
 */

export type RoleFamily =
  | 'product'
  | 'project'
  | 'analytics'
  | 'data'
  | 'ml'
  | 'design'
  | 'marketing'
  | 'sales'
  | 'hr'
  | 'finance'
  | 'legal'
  | 'support'
  | 'qa'
  | 'devops'
  | 'backend'
  | 'frontend'
  | 'fullstack'
  | 'mobile'
  | 'systems'
  | 'management'
  | 'unknown';

/** Приоритет разрешения конфликтов, если сработает несколько семей. */
const FAMILY_PRIORITY: RoleFamily[] = [
  'ml',
  'data',
  'analytics',
  'product',
  'project',
  'design',
  'marketing',
  'sales',
  'hr',
  'finance',
  'legal',
  'qa',
  'devops',
  'mobile',
  'frontend',
  'backend',
  'fullstack',
  'systems',
  'support',
  'management',
];

interface FamilyRules {
  /** «Якорные» фразы — сильный сигнал (биграммы/триграммы). */
  phrases: string[];
  /** Одиночные токены-маркеры. Учитываются только при отсутствии якоря другого семейства. */
  tokens: string[];
}

/**
 * Словари. Ключевые паттерны — в нижнем регистре.
 * Сознательно держим здесь и англ., и рус. варианты: каталог смешанный.
 */
const FAMILY_RULES: Record<Exclude<RoleFamily, 'unknown'>, FamilyRules> = {
  product: {
    phrases: [
      'product manager',
      'product owner',
      'head of product',
      'group product manager',
      'chief product officer',
      'cpo',
      'product lead',
      'lead product',
      'senior product',
      'менеджер продукта',
      'продуктовый менеджер',
      'продуктовый директор',
      'руководитель продукта',
      'директор по продукту',
      'владелец продукта',
    ],
    tokens: ['product', 'продакт', 'продуктовый', 'продуктовая'],
  },
  project: {
    phrases: [
      'project manager',
      'program manager',
      'delivery manager',
      'scrum master',
      'agile coach',
      'руководитель проекта',
      'менеджер проекта',
      'менеджер проектов',
      'проджект менеджер',
    ],
    tokens: ['projectmanager', 'проджект'],
  },
  analytics: {
    phrases: [
      'business analyst',
      'product analyst',
      'system analyst',
      'data analyst',
      'marketing analyst',
      'web analyst',
      'бизнес аналитик',
      'бизнес-аналитик',
      'продуктовый аналитик',
      'системный аналитик',
      'веб-аналитик',
      'веб аналитик',
      'маркетинговый аналитик',
    ],
    tokens: ['аналитик', 'analyst'],
  },
  data: {
    phrases: [
      'data engineer',
      'data scientist',
      'big data',
      'data architect',
      'инженер данных',
      'инженер по данным',
      'дата инженер',
      'дата саентист',
      'data platform',
    ],
    tokens: ['dataengineer', 'datascientist'],
  },
  ml: {
    phrases: [
      'machine learning',
      'ml engineer',
      'ml researcher',
      'deep learning',
      'computer vision',
      'nlp engineer',
      'ai engineer',
      'ai инженер',
      'ml инженер',
      'ии инженер',
      'искусственный интеллект',
      'llm engineer',
      'mlops',
    ],
    tokens: ['mlops', 'llm'],
  },
  design: {
    phrases: [
      'ux designer',
      'ui designer',
      'product designer',
      'ux/ui',
      'ui/ux',
      'motion designer',
      'графический дизайнер',
      'продуктовый дизайнер',
      'веб-дизайнер',
      'веб дизайнер',
    ],
    tokens: ['designer', 'дизайнер'],
  },
  marketing: {
    phrases: [
      'digital marketing',
      'marketing manager',
      'brand manager',
      'performance marketing',
      'growth marketing',
      'smm manager',
      'контент маркетолог',
      'перформанс маркетолог',
      'бренд менеджер',
      'бренд-менеджер',
      'маркетинг директор',
    ],
    tokens: ['маркетолог', 'marketer', 'smm'],
  },
  sales: {
    phrases: [
      'sales manager',
      'account manager',
      'account executive',
      'business development',
      'sales executive',
      'менеджер по продажам',
      'руководитель отдела продаж',
      'директор по продажам',
      'аккаунт менеджер',
      'key account',
    ],
    tokens: ['salesmanager'],
  },
  hr: {
    phrases: [
      'hr manager',
      'hr business partner',
      'hrbp',
      'talent acquisition',
      'it recruiter',
      'recruiter',
      'менеджер по персоналу',
      'рекрутер',
      'рекрутёр',
      'hr директор',
    ],
    tokens: ['hrbp', 'рекрутер', 'рекрутёр'],
  },
  finance: {
    phrases: [
      'financial analyst',
      'financial manager',
      'cfo',
      'chief financial officer',
      'финансовый аналитик',
      'финансовый директор',
      'финансовый менеджер',
      'главный бухгалтер',
    ],
    tokens: [],
  },
  legal: {
    phrases: [
      'юрист',
      'юрисконсульт',
      'legal counsel',
      'corporate lawyer',
      'compliance officer',
    ],
    tokens: ['юрист'],
  },
  support: {
    phrases: [
      'customer support',
      'customer success',
      'technical support',
      'техническая поддержка',
      'служба поддержки',
      'специалист поддержки',
    ],
    tokens: [],
  },
  qa: {
    phrases: [
      'qa engineer',
      'qa automation',
      'automation qa',
      'test engineer',
      'manual qa',
      'автотестировщик',
      'тестировщик',
      'инженер по тестированию',
      'qa lead',
    ],
    tokens: ['тестировщик'],
  },
  devops: {
    phrases: [
      'devops engineer',
      'site reliability',
      'sre engineer',
      'инженер эксплуатации',
      'cloud engineer',
      'platform engineer',
      'инфраструктурный инженер',
    ],
    tokens: ['devops', 'sre'],
  },
  backend: {
    phrases: [
      'backend developer',
      'back-end developer',
      'back end developer',
      'backend engineer',
      'бэкенд разработчик',
      'бекенд разработчик',
      'back-end разработчик',
      'server-side developer',
      // Специализированные бэкенд-стеки: язык + "разработчик/developer".
      'python разработчик',
      'python-разработчик',
      'python developer',
      'node.js разработчик',
      'node разработчик',
      'node.js developer',
      'node developer',
      'java разработчик',
      'java developer',
      'golang разработчик',
      'golang developer',
      'go разработчик',
      'go developer',
      'c# разработчик',
      'c# developer',
      '.net разработчик',
      '.net developer',
      'php разработчик',
      'php developer',
      'ruby разработчик',
      'ruby developer',
      'kotlin backend',
      'scala разработчик',
      'rust разработчик',
    ],
    tokens: ['backend', 'бэкенд', 'бекенд'],
  },
  frontend: {
    phrases: [
      'frontend developer',
      'front-end developer',
      'front end developer',
      'frontend engineer',
      'фронтенд разработчик',
      'фронт-енд разработчик',
      'ui разработчик',
      'react разработчик',
      'angular разработчик',
      'vue разработчик',
    ],
    tokens: ['frontend', 'фронтенд'],
  },
  fullstack: {
    phrases: [
      'fullstack developer',
      'full-stack developer',
      'full stack developer',
      'fullstack engineer',
      'фулстек разработчик',
      'фулл-стек разработчик',
      'фуллстек',
      'full-stack разработчик',
    ],
    tokens: ['fullstack', 'фулстек'],
  },
  mobile: {
    phrases: [
      'ios developer',
      'android developer',
      'mobile developer',
      'react native developer',
      'flutter developer',
      'android разработчик',
      'ios разработчик',
      'мобильный разработчик',
    ],
    tokens: [],
  },
  systems: {
    phrases: [
      'system administrator',
      'сетевой инженер',
      'системный администратор',
      'network engineer',
      'сетевой администратор',
    ],
    tokens: [],
  },
  management: {
    phrases: [
      'chief executive officer',
      'chief operations officer',
      'chief technology officer',
      'head of engineering',
      'head of operations',
      'engineering manager',
      'tech lead',
      'team lead',
      'руководитель разработки',
      'технический директор',
      'операционный директор',
      'генеральный директор',
    ],
    tokens: ['cto', 'ceo', 'coo'],
  },
};

/**
 * Классифицировать произвольный текст (заголовок вакансии, желаемая роль,
 * фрагмент саммари) в семейство. При множественных совпадениях выбирается
 * семейство с более сильным сигналом (phrase > token) и по FAMILY_PRIORITY.
 */
export function classifyRoleFamily(rawText: string | null | undefined): RoleFamily {
  if (!rawText || typeof rawText !== 'string') return 'unknown';
  const text = rawText.toLowerCase();

  const phraseHits = new Set<RoleFamily>();
  const tokenHits = new Set<RoleFamily>();

  for (const [family, rules] of Object.entries(FAMILY_RULES) as [
    Exclude<RoleFamily, 'unknown'>,
    FamilyRules,
  ][]) {
    for (const phrase of rules.phrases) {
      if (text.includes(phrase)) {
        phraseHits.add(family);
        break;
      }
    }
  }

  if (phraseHits.size === 0) {
    for (const [family, rules] of Object.entries(FAMILY_RULES) as [
      Exclude<RoleFamily, 'unknown'>,
      FamilyRules,
    ][]) {
      for (const token of rules.tokens) {
        if (text.includes(token)) {
          tokenHits.add(family);
          break;
        }
      }
    }
  }

  const hits = phraseHits.size > 0 ? phraseHits : tokenHits;
  if (hits.size === 0) return 'unknown';

  for (const fam of FAMILY_PRIORITY) {
    if (hits.has(fam)) return fam;
  }

  return 'unknown';
}

/**
 * Классификация пользователя по нескольким полям профиля. Возвращает
 * до 3 семейств — основное и смежные, которые тоже можно показывать.
 *
 * Пример для Senior PM:
 *   desiredRole  = 'Head of Product / Group Product Manager' -> product
 *   position_1_role = 'Senior Product Manager' -> product
 *   position_2_role = 'Product Manager' -> product
 *   careerSummary содержит 'бизнес-аналитиком' -> analytics (смежное)
 *   Итог: primary=product, adjacent=[analytics]
 */
export interface ProfileRoleClassification {
  primary: RoleFamily;
  adjacent: RoleFamily[];
  /** Все детектированные семейства в порядке силы сигнала. */
  detected: RoleFamily[];
}

interface ProfileRoleSources {
  desiredRole?: string | null;
  positionRoles?: Array<string | null | undefined>;
  careerSummary?: string | null;
}

/**
 * Смежные семейства: матчеру можно показывать эти роли как weak-совпадение,
 * но не как primary-рекомендацию. Например, продуктовому менеджеру уместно
 * иногда видеть вакансии продуктового аналитика, но не React-разработчика.
 */
const ADJACENT_FAMILIES: Record<RoleFamily, RoleFamily[]> = {
  product: ['analytics', 'project', 'management'],
  project: ['product', 'management'],
  analytics: ['product', 'data'],
  data: ['analytics', 'ml', 'backend'],
  ml: ['data', 'backend'],
  design: ['product'],
  marketing: ['product', 'sales'],
  sales: ['marketing'],
  hr: [],
  finance: ['analytics'],
  legal: [],
  support: [],
  qa: ['backend', 'frontend', 'devops'],
  devops: ['backend', 'systems'],
  backend: ['fullstack', 'devops', 'data'],
  frontend: ['fullstack', 'mobile', 'design'],
  fullstack: ['backend', 'frontend'],
  mobile: ['frontend', 'fullstack'],
  systems: ['devops'],
  management: ['product', 'project'],
  unknown: [],
};

export function classifyProfileRoles(sources: ProfileRoleSources): ProfileRoleClassification {
  const detectedOrdered: RoleFamily[] = [];

  const addDetected = (fam: RoleFamily) => {
    if (fam === 'unknown') return;
    if (!detectedOrdered.includes(fam)) detectedOrdered.push(fam);
  };

  // Desired role — сильнейший сигнал.
  addDetected(classifyRoleFamily(sources.desiredRole || ''));

  // Далее позиции из истории, от последней к первой.
  for (const role of sources.positionRoles ?? []) {
    addDetected(classifyRoleFamily(role || ''));
  }

  // CareerSummary — слабый сигнал, только как дополнение.
  if (sources.careerSummary) {
    addDetected(classifyRoleFamily(sources.careerSummary));
  }

  if (detectedOrdered.length === 0) {
    return { primary: 'unknown', adjacent: [], detected: [] };
  }

  const primary = detectedOrdered[0];
  const adjacentFromMap = ADJACENT_FAMILIES[primary] ?? [];

  const adjacent = Array.from(
    new Set([
      ...detectedOrdered.slice(1),
      ...adjacentFromMap,
    ])
  ).filter((f) => f !== primary);

  return { primary, adjacent, detected: detectedOrdered };
}

/**
 * Набор ключевых слов для скрапера по семейству (RU + EN для двух источников).
 * Используется при `scrapeForUser(...)`: мы подаём эти кейворды в HH/SuperJob
 * вместо дефолтного dev-набора.
 */
export function keywordsForFamily(family: RoleFamily): string[] {
  const base: Record<RoleFamily, string[]> = {
    product: [
      'Product Manager',
      'Менеджер продукта',
      'Product Owner',
      'Head of Product',
      'Group Product Manager',
      'Продуктовый менеджер',
    ],
    project: [
      'Project Manager',
      'Руководитель проекта',
      'Delivery Manager',
      'Scrum Master',
      'Program Manager',
    ],
    analytics: [
      'Бизнес-аналитик',
      'Business Analyst',
      'Продуктовый аналитик',
      'Product Analyst',
      'Системный аналитик',
      'Data Analyst',
    ],
    data: ['Data Engineer', 'Дата инженер', 'Data Platform Engineer', 'ETL Engineer'],
    ml: ['ML Engineer', 'Machine Learning Engineer', 'AI Engineer', 'Data Scientist', 'MLOps'],
    design: [
      'Product Designer',
      'UX/UI Designer',
      'Продуктовый дизайнер',
      'UX Designer',
      'UI Designer',
    ],
    marketing: [
      'Marketing Manager',
      'Маркетолог',
      'Performance Marketing',
      'Growth Marketing',
      'Brand Manager',
    ],
    sales: [
      'Sales Manager',
      'Менеджер по продажам',
      'Account Manager',
      'Business Development Manager',
    ],
    hr: ['HR Manager', 'HR Business Partner', 'Рекрутер', 'IT Recruiter'],
    finance: ['Финансовый аналитик', 'Financial Analyst', 'Финансовый менеджер'],
    legal: ['Юрист', 'Legal Counsel'],
    support: ['Customer Success Manager', 'Customer Support Manager'],
    qa: ['QA Engineer', 'Тестировщик', 'QA Automation', 'Автотестировщик'],
    devops: ['DevOps Engineer', 'SRE Engineer', 'Platform Engineer', 'Cloud Engineer'],
    backend: ['Backend Developer', 'Бэкенд разработчик', 'Backend Engineer'],
    frontend: ['Frontend Developer', 'Фронтенд разработчик', 'React Developer'],
    fullstack: ['Fullstack Developer', 'Фулстек разработчик'],
    mobile: ['iOS Developer', 'Android Developer', 'Mobile Developer'],
    systems: ['Системный администратор', 'System Administrator'],
    management: ['Head of Engineering', 'Engineering Manager', 'Tech Lead'],
    unknown: [],
  };
  return base[family] ?? [];
}

/**
 * Короткое человекочитаемое имя семейства — для логов, тултипов и API.
 */
export function familyLabelRu(family: RoleFamily): string {
  const map: Record<RoleFamily, string> = {
    product: 'Продукт',
    project: 'Проект',
    analytics: 'Аналитика',
    data: 'Данные',
    ml: 'ML/AI',
    design: 'Дизайн',
    marketing: 'Маркетинг',
    sales: 'Продажи',
    hr: 'HR',
    finance: 'Финансы',
    legal: 'Юриспруденция',
    support: 'Поддержка',
    qa: 'QA',
    devops: 'DevOps',
    backend: 'Backend',
    frontend: 'Frontend',
    fullstack: 'Fullstack',
    mobile: 'Мобильная разработка',
    systems: 'Системное администрирование',
    management: 'Менеджмент',
    unknown: 'Не определено',
  };
  return map[family] ?? family;
}
