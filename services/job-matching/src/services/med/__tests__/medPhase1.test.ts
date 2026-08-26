import {
  mapVacancyToMedRole,
  MED_UNKNOWN_ROLE_ID,
  buildMedScrapeKeywords,
  listActiveMedTgChannels,
  isMedVerticalEnabled,
} from '../index';

describe('med/mapRole', () => {
  it('maps exact doctor titles', () => {
    const m = mapVacancyToMedRole('Врач-терапевт');
    expect(m.med_role_id).toBe('doctor_vrach_terapevt');
    expect(m.level).toBe('doctor');
    expect(['exact', 'alias', 'partial']).toContain(m.confidence);
  });

  it('maps mid and junior via aliases', () => {
    const mid = mapVacancyToMedRole('Медсестра процедурной');
    expect(mid.level === 'mid' || mid.med_role_id !== MED_UNKNOWN_ROLE_ID).toBe(true);

    const junior = mapVacancyToMedRole('Санитарка в больницу');
    expect(junior.med_role_id).not.toBe(MED_UNKNOWN_ROLE_ID);
    expect(junior.level).toBe('junior');
  });

  it('maps pharma, leadership and caregiver vacancy titles', () => {
    expect(mapVacancyToMedRole('Провизор в аптеку').med_role_id).toBe('doctor_provizor');
    expect(mapVacancyToMedRole('Фармацевт').med_role_id).toBe('mid_farmacevt');
    expect(mapVacancyToMedRole('Главный врач клиники').med_role_id).toBe('doctor_glavnyj_vrach');
    expect(mapVacancyToMedRole('Сиделка').med_role_id).toBe('junior_sidelka');
    expect(mapVacancyToMedRole('Санитар-водитель СМП').med_role_id).toBe('junior_sanitar_voditel');
  });
});

describe('med/keywords', () => {
  it('builds doctor-first keyword list within limit', () => {
    const kw = buildMedScrapeKeywords(20);
    expect(kw.length).toBeLessThanOrEqual(20);
    expect(kw.length).toBeGreaterThanOrEqual(6);
    expect(kw.some((k) => /врач/i.test(k))).toBe(true);
  });
});

describe('med Phase 1 registry', () => {
  it('activates all Med TG channels from the wife registry', () => {
    const active = listActiveMedTgChannels();
    expect(active.length).toBe(12);
    expect(active.map((c) => c.username)).toEqual(
      expect.arrayContaining([
        'superjob_medicina',
        'rabota_medsestra',
        'csorglaborantmladpersonal',
        'med_vacancy',
        'medsmena',
        'hh_vacancy_medicine',
      ])
    );
  });

  it('keeps flag off by default', () => {
    const prev = process.env.ENABLE_MED_VERTICAL;
    delete process.env.ENABLE_MED_VERTICAL;
    expect(isMedVerticalEnabled()).toBe(false);
    if (prev === undefined) delete process.env.ENABLE_MED_VERTICAL;
    else process.env.ENABLE_MED_VERTICAL = prev;
  });
});
