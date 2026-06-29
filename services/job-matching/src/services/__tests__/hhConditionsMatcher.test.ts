import { Job } from '../../models/job';
import {
  matchHhEmployment,
  matchHhEmploymentForms,
  matchHhExperienceFromMeta,
  matchHhVacancyConditions,
  matchHhWorkSchedule,
  resolveJobWorkMode,
  resolveUserEmploymentPreference,
} from '../hhConditionsMatcher';
import { CollectedData } from '../userService';
import type { HhVacancyMeta } from '../../utils/hhVacancyMeta';

function mkJob(meta: HhVacancyMeta | null, partial: Partial<Job> = {}): Job {
  const now = new Date();
  return {
    id: 'job-1',
    title: 'Product Owner',
    company: 'Acme',
    location: ['Москва'],
    salary_min: null,
    salary_max: null,
    currency: null,
    description: '',
    requirements: '',
    skills: [],
    experience_level: 'senior',
    work_mode: 'office',
    source_meta: meta,
    source: 'hh.ru',
    source_url: 'https://hh.ru/vacancy/123',
    role_family: 'product',
    posted_at: now,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

const FULL_META: HhVacancyMeta = {
  experienceLabel: 'Более 6 лет',
  experienceId: 'moreThan6',
  employmentLabel: 'Полная занятость',
  employmentId: 'full',
  employmentForms: ['Трудовой договор', 'Договор ГПХ с ИП'],
  employmentFormIds: ['FULL', 'CIVIL_LAW'],
  scheduleLabel: 'Полный день',
  scheduleId: 'fullDay',
  workScheduleDays: '5/2',
  workScheduleDayIds: ['FIVE_ON_TWO_OFF'],
  workingHours: '8',
  workingHourIds: ['HOURS_8'],
  workFormatLabel: 'Гибрид',
  workFormatIds: ['HYBRID'],
};

describe('hhConditionsMatcher', () => {
  it('scores experience from HH meta instead of coarse seniority', () => {
    const job = mkJob(FULL_META);
    const perfect = matchHhExperienceFromMeta(job, 8);
    expect(perfect?.points).toBe(15);
    expect(perfect?.reason).toContain('Более 6 лет');

    const weak = matchHhExperienceFromMeta(job, 2);
    expect(weak?.points).toBe(0);
  });

  it('uses work_format from source_meta for work mode', () => {
    const job = mkJob(FULL_META, { work_mode: 'office' });
    expect(resolveJobWorkMode(job)).toBe('hybrid');
  });

  it('matches employment when profile implies full-time', () => {
    const profile: CollectedData = { totalExperience: 8 };
    expect(resolveUserEmploymentPreference(profile)).toBe('full');
    const result = matchHhEmployment(FULL_META, profile);
    expect(result?.points).toBe(6);
    expect(result?.reason).toContain('Полная занятость');
  });

  it('penalizes GPH-only vacancy when user rejects GPH', () => {
    const gphOnly: HhVacancyMeta = {
      ...FULL_META,
      employmentForms: ['Договор ГПХ с ИП'],
      employmentFormIds: ['CIVIL_LAW'],
    };
    const profile: CollectedData = { acceptGph: false };
    const result = matchHhEmploymentForms(gphOnly, profile);
    expect(result?.points).toBe(-6);
  });

  it('adds informational schedule reason when vacancy has schedule but profile does not', () => {
    const profile: CollectedData = { totalExperience: 8 };
    const result = matchHhWorkSchedule(FULL_META, profile);
    expect(result?.points).toBe(0);
    expect(result?.reason).toContain('5/2');
  });

  it('scores schedule when profile preference matches', () => {
    const profile: CollectedData = { workSchedulePreference: 'FIVE_ON_TWO_OFF' };
    const result = matchHhWorkSchedule(FULL_META, profile);
    expect(result?.points).toBe(4);
  });

  it('aggregates HH condition factors', () => {
    const job = mkJob(FULL_META);
    const profile: CollectedData = {
      totalExperience: 8,
      workMode: 'hybrid',
      workSchedulePreference: 'FIVE_ON_TWO_OFF',
      workingHoursPreference: '8',
    };
    const { points, reasons } = matchHhVacancyConditions(job, profile);
    expect(points).toBeGreaterThan(0);
    expect(reasons.some((r) => r.includes('Занятость'))).toBe(true);
    expect(reasons.some((r) => r.includes('График'))).toBe(true);
  });

  it('returns nothing when source_meta is missing', () => {
    const job = mkJob(null);
    expect(matchHhVacancyConditions(job, { totalExperience: 8 })).toEqual({
      points: 0,
      reasons: [],
    });
  });
});
