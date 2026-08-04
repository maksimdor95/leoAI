/**
 * Card-field normalization for scraped jobs (esp. TG).
 * Keep in sync with frontend/lib/normalizeVacancyCard.ts — light titles with domain context.
 */

const TITLE_MAX = 100;
const PITCH_CUT_RE =
  /\s*[—–\-]\s*(?:это|мы|наш[аеи]?|компания|экосистема|сервис|платформа)\b.*$/i;
const IN_COMPANY_RE = /^(.+?)\s+(?:в|at|@)\s+(.+)$/i;
const TEAM_ORG_START_RE =
  /^(?:команд[ауеыи]?|отдел(?:е|у|а)?|групп[ауеыи]?|направлен(?:ие|ии|ию)?|стрим(?:е|у|а)?|tribe|squad)/i;
const ROLE_START_RE =
  /^((?:(?:Senior|Junior|Middle|Lead|Principal|Staff|Chief)\s+)?(?:Head\s+of\s+(?:Digital\s+)?Product|Product\s+(?:Owner|Manager|Lead|Director|Analyst)|CPO|CTO|CEO|Директор\s+по\s+продукту|Руководитель\s+(?:цифрового\s+)?продукта|Руководитель\s+направления|Владелец\s+продукта|Менеджер\s+продукта|Продакт(?:[-\s]?менеджер)?|Product\s+Manager|Project\s+Manager|Менеджер\s+проектов|GenAI\s+Product|Technical\s+Product\s+Lead))(.*)$/i;

function clean(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s·—–\-|📍]+|[\s·—–\-|]+$/g, '')
    .trim();
}

function stripEmojiNoise(text: string): string {
  return text
    .replace(/📍[^·|—–\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTeamOrgPart(orgPart: string): boolean {
  return TEAM_ORG_START_RE.test(orgPart.trim().replace(/^«|"/, ''));
}

function isDomainRest(rest: string): boolean {
  const r = rest.trim();
  if (!r) return false;
  if (/^\(/.test(r)) return true;
  if (/^в\s+/i.test(r) && isTeamOrgPart(r.replace(/^в\s+/i, ''))) return true;
  return false;
}

function isBrandRest(rest: string): boolean {
  if (!rest || isDomainRest(rest)) return false;
  if (/^в\s+/i.test(rest)) return false;
  if (/\b(это|который|которая|помогает)\b/i.test(rest)) return false;
  const words = rest.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 3 && rest.length <= 40;
}

function firstSegmentBeforeBullet(text: string): string {
  for (const sep of [' · ', ' | ', ' / ']) {
    if (text.includes(sep)) {
      const left = text.split(sep, 1)[0].trim();
      if (left.length >= 8) return left;
    }
  }
  return text;
}

function companyTail(rawOrg: string): string {
  return clean(rawOrg)
    .split(/[—–\-·|]/)[0]
    .trim()
    .replace(/📍.*$/, '')
    .trim();
}

export function cleanJobTitle(raw: string, org?: string | null): string {
  let text = clean(stripEmojiNoise(raw || ''));
  if (!text) return 'Вакансия';

  text = text.replace(PITCH_CUT_RE, '').replace(/^[\s·—–\-|]+|[\s·—–\-|]+$/g, '').trim();
  text = firstSegmentBeforeBullet(text);

  if (text.length > TITLE_MAX) {
    const sentence = text.search(/[.!?](?:\s|$)/);
    if (sentence >= 12 && sentence <= TITLE_MAX) {
      text = text.slice(0, sentence).trim();
    }
  }

  const inCompany = text.match(IN_COMPANY_RE);
  if (inCompany && !isTeamOrgPart(inCompany[2])) {
    const rolePart = clean(inCompany[1]);
    const orgPart = companyTail(inCompany[2]);
    if (rolePart.length >= 18) {
      text = rolePart;
    } else if (rolePart.length >= 4 && orgPart && orgPart.length <= 40) {
      text = `${rolePart} в ${orgPart}`;
    }
  }

  const roleMatch = text.match(ROLE_START_RE);
  if (roleMatch) {
    const role = clean(roleMatch[1]);
    const rest = clean(roleMatch[2] || '');
    if (rest && isDomainRest(rest)) {
      text = `${role} ${rest}`.replace(/\s+/g, ' ').trim();
    } else if (rest && isBrandRest(rest)) {
      text = role;
    }
  }

  if (org) {
    const orgC = clean(org);
    if (orgC && text.toLowerCase().endsWith(orgC.toLowerCase())) {
      const prefix = text.slice(0, -orgC.length).replace(/[\s·—–\-|]+$/g, '').trim();
      const keptAsCompanyCue = /\sв$/i.test(prefix);
      const teamDomain = /в\s+(?:команд|отдел|групп|направлен)/i.test(text);
      if (!keptAsCompanyCue && !teamDomain && prefix.length >= 8) {
        text = prefix;
      }
    }
  }

  if (text.length > TITLE_MAX) {
    const cut = text.slice(0, TITLE_MAX - 1).replace(/\s+\S*$/, '');
    text = `${(cut || text.slice(0, TITLE_MAX - 1)).replace(/[.,;:]+$/, '')}…`;
  }

  return text || clean(raw).slice(0, TITLE_MAX) || 'Вакансия';
}

export function guessOrgFromTitle(raw: string, existingOrg?: string | null): string | null {
  const existing = clean(existingOrg || '');
  if (existing && !/^[A-Za-z][A-Za-z0-9_]{2,40}$/.test(existing)) return existing;

  const text = firstSegmentBeforeBullet(
    clean(stripEmojiNoise(raw || '')).replace(PITCH_CUT_RE, '').trim()
  );
  const inCompany = text.match(IN_COMPANY_RE);
  if (inCompany && !isTeamOrgPart(inCompany[2])) {
    const org = companyTail(inCompany[2]);
    if (org.length >= 2 && org.length <= 60) return org;
  }
  return existing || null;
}
