import {
  classifyRoleFamily,
  classifyProfileRoles,
  keywordsForFamily,
} from '../roleFamily';

describe('classifyRoleFamily', () => {
  const cases: Array<[string, string]> = [
    ['Senior Product Manager', 'product'],
    ['Head of Product', 'product'],
    ['Group Product Manager', 'product'],
    ['Менеджер продукта', 'product'],
    ['Продуктовый менеджер B2B SaaS', 'product'],
    ['Project Manager', 'project'],
    ['Руководитель проекта', 'project'],
    ['Business Analyst', 'analytics'],
    ['Бизнес-аналитик', 'analytics'],
    ['Продуктовый аналитик', 'analytics'],
    ['Data Engineer', 'data'],
    ['ML Engineer', 'ml'],
    ['AI инженер', 'ml'],
    ['Frontend-разработчик (React, TypeScript)', 'frontend'],
    ['React разработчик', 'frontend'],
    ['Node.js разработчик', 'backend'],
    ['Backend-разработчик (TypeScript, Junior)', 'backend'],
    ['Fullstack-разработчик (React / Node / Typescript / Nest)', 'fullstack'],
    ['QA Engineer (API / Playwright / TypeScript)', 'qa'],
    ['Автотестировщик Python/TypeScript', 'qa'],
    ['DevOps Engineer', 'devops'],
    ['UX/UI Designer', 'design'],
    ['Sales Manager', 'sales'],
    ['Account Manager', 'sales'],
    ['HR Business Partner', 'hr'],
    ['iOS Developer', 'mobile'],
    ['Senior Python-разработчик', 'backend'],
    ['Системный администратор, IT-специалист', 'systems'],
  ];

  it.each(cases)('%s -> %s', (title, expected) => {
    expect(classifyRoleFamily(title)).toBe(expected);
  });

  it('returns unknown for empty / unrecognized text', () => {
    expect(classifyRoleFamily('')).toBe('unknown');
    expect(classifyRoleFamily('Инженер по тестированию встроенных систем с AUTOSAR')).toBe(
      'qa'
    );
    expect(classifyRoleFamily('   ')).toBe('unknown');
    expect(classifyRoleFamily(null)).toBe('unknown');
  });
});

describe('classifyProfileRoles', () => {
  it('classifies Senior PM profile as product with analytics adjacent', () => {
    const result = classifyProfileRoles({
      desiredRole: 'Head of Product / Group Product Manager',
      positionRoles: ['Senior Product Manager', 'Product Manager'],
      careerSummary:
        'Начинал бизнес-аналитиком, затем вырос до Senior Product Manager в B2B SaaS.',
    });
    expect(result.primary).toBe('product');
    expect(result.adjacent).toEqual(expect.arrayContaining(['analytics']));
  });

  it('classifies Analyst profile with data/product adjacent', () => {
    const result = classifyProfileRoles({
      desiredRole: 'Senior Data Analyst',
      positionRoles: ['Data Analyst', 'Business Analyst'],
      careerSummary: 'Работал с SQL и дашбордами.',
    });
    expect(result.primary).toBe('analytics');
  });

  it('unknown when no role provided', () => {
    const result = classifyProfileRoles({});
    expect(result.primary).toBe('unknown');
  });
});

describe('keywordsForFamily', () => {
  it('returns product-centric keywords for product family', () => {
    const kws = keywordsForFamily('product');
    expect(kws).toEqual(expect.arrayContaining(['Product Manager', 'Менеджер продукта']));
  });
  it('returns empty for unknown family', () => {
    expect(keywordsForFamily('unknown')).toEqual([]);
  });
});
