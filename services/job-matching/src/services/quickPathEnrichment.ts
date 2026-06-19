import { CollectedData } from './userService';
import {
  extractSkillsFromTextWithLexicon,
  skillsForProfileText,
} from './skillLexicon';

const WORK_MODE_MARKERS =
  /^(удален[a-zа-яё0-9]*|remote|дистанц[a-zа-яё0-9]*|гибрид|hybrid|офис|office|из\s+дома|home\s*office)$/i;

const SALARY_PATTERNS = [
  /(?:от|from)\s*(\d[\d\s]{2,})\s*(?:₽|руб|р\.|rub)?/i,
  /(\d[\d\s]{2,})\s*(?:₽|руб|р\.|rub)/i,
  /(\d{2,3})\s*(?:к|k)\b/i,
  /(?:^|[,;]\s*)(\d[\d\s]{4,})(?:\s*[,;]|$)/,
];

function isWorkModeToken(value: string): boolean {
  return WORK_MODE_MARKERS.test(value.trim());
}

export function extractSalaryFromText(text: string): string | null {
  for (const pattern of SALARY_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const digits = match[1].replace(/\s/g, '');
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n) || n < 10) continue;
    const amount = /к|k/i.test(match[0]) && n < 1000 ? n * 1000 : n;
    return `от ${amount.toLocaleString('ru-RU')} ₽`;
  }
  return null;
}

export function extractWorkModeFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/удален|remote|дистанц|из\s+дома/.test(lower)) return 'remote';
  if (/гибрид|hybrid/.test(lower)) return 'hybrid';
  if (/\bофис\b|office/.test(lower)) return 'office';
  return undefined;
}

export function extractCitiesFromDesiredLocation(raw: unknown): string[] {
  let parts: string[] = [];
  if (typeof raw === 'string' && raw.trim()) {
    parts = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(raw)) {
    parts = raw.map((x) => String(x)).filter(Boolean);
  }
  return parts.filter(
    (p) =>
      !isWorkModeToken(p) &&
      !extractSalaryFromText(p) &&
      !/^\d[\d\s]{2,}$/.test(p.trim())
  );
}

const EXPERIENCE_YEAR_PATTERNS = [
  /(\d+(?:[.,]\d+)?)\s*(?:лет|года|год|г\.)/i,
  /(?:опыт|стаж|работаю|работал)\s*(?:—|–|-|:)?\s*(\d+(?:[.,]\d+)?)/i,
  /(\d+(?:[.,]\d+)?)\s*(?:years?|yrs?)/i,
];

export function extractExperienceYearsFromText(text: string): number | null {
  for (const pattern of EXPERIENCE_YEAR_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const years = parseFloat(match[1].replace(',', '.'));
      if (Number.isFinite(years) && years > 0 && years < 50) return years;
    }
  }
  return null;
}

/**
 * Обогащает collectedData после Quick Path: годы, город, remote, зарплата, навыки.
 * Исходные текстовые поля (careerSummary, desired_location) не затираются.
 */
export function enrichQuickPathCollectedData(raw: CollectedData): CollectedData {
  const merged: CollectedData = { ...raw };

  const desiredRole =
    (typeof raw.desiredRole === 'string' ? raw.desiredRole : undefined) ||
    (typeof raw.desired_role === 'string' ? raw.desired_role : undefined);
  if (desiredRole && !merged.desiredRole) {
    merged.desiredRole = desiredRole.trim();
  }

  const careerText = typeof raw.careerSummary === 'string' ? raw.careerSummary : '';
  if (merged.totalExperience == null && careerText) {
    const years = extractExperienceYearsFromText(careerText);
    if (years !== null) merged.totalExperience = years;
  }

  const locationText = typeof raw.desired_location === 'string' ? raw.desired_location : '';
  const cities = extractCitiesFromDesiredLocation(raw.desired_location ?? raw.location);
  if (cities.length > 0) {
    merged.location = cities;
  }

  if (!merged.workMode && locationText) {
    const mode = extractWorkModeFromText(locationText);
    if (mode) merged.workMode = mode;
  }

  if (!merged.salaryExpectation && locationText) {
    const salary = extractSalaryFromText(locationText);
    if (salary) merged.salaryExpectation = salary;
  }

  const existingSkills = Array.isArray(merged.skills) ? merged.skills.map(String) : [];
  if (existingSkills.length === 0 && careerText) {
    const lexicon = skillsForProfileText({
      desiredRole,
      careerSummary: careerText,
    });
    const extracted = extractSkillsFromTextWithLexicon(careerText, lexicon);
    if (extracted.length > 0) merged.skills = extracted;
  }

  return merged;
}
