import {
  getMedRoleById,
  getMedRolesCatalog,
  getMedSourcesRegistry,
  isMedVerticalEnabled,
  listMedRoles,
  listMedSources,
  listOpenMedRoles,
} from '../index';

describe('med/config', () => {
  const ORIGINAL = process.env.ENABLE_MED_VERTICAL;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ENABLE_MED_VERTICAL;
    else process.env.ENABLE_MED_VERTICAL = ORIGINAL;
  });

  it('is off by default', () => {
    delete process.env.ENABLE_MED_VERTICAL;
    expect(isMedVerticalEnabled()).toBe(false);
  });

  it('enables only when ENABLE_MED_VERTICAL=true', () => {
    process.env.ENABLE_MED_VERTICAL = 'true';
    expect(isMedVerticalEnabled()).toBe(true);
    process.env.ENABLE_MED_VERTICAL = '1';
    expect(isMedVerticalEnabled()).toBe(false);
  });
});

describe('med/catalog', () => {
  it('loads doctor + mid + junior roles from 434н + taxonomy extensions', () => {
    const catalog = getMedRolesCatalog();
    expect(catalog.version).toBeGreaterThanOrEqual(2);
    expect(catalog.source.title).toMatch(/434н/);
    expect(catalog.source.extensions?.length).toBeGreaterThan(0);
    expect(catalog.levels.map((l) => l.id)).toEqual(['doctor', 'mid', 'junior']);

    const doctors = listMedRoles('doctor');
    const mid = listMedRoles('mid');
    const junior = listMedRoles('junior');
    expect(doctors.length).toBeGreaterThanOrEqual(120);
    expect(mid.length).toBeGreaterThanOrEqual(60);
    expect(junior.length).toBeGreaterThanOrEqual(4);
    expect(getMedRoleById('doctor_provizor')?.title).toBe('Провизор');
    expect(getMedRoleById('doctor_glavnyj_vrach')?.title).toBe('Главный врач');
    expect(getMedRoleById('junior_sidelka')?.title).toBe('Сиделка');
    expect(getMedRoleById('mid_farmacevt')?.title).toBe('Фармацевт');
    expect(listMedRoles().length).toBe(doctors.length + mid.length + junior.length);
  });

  it('resolves role by id and filters open hiring', () => {
    const role = getMedRoleById('doctor_vrach_terapevt');
    expect(role?.title).toBe('Врач-терапевт');
    expect(role?.id).not.toMatch(/-/);

    const closed = listMedRoles('doctor').find((r) => r.hiring_closed_from === '2026-09-01');
    expect(closed).toBeTruthy();

    const beforeClose = listOpenMedRoles('doctor', new Date('2026-08-01'));
    const afterClose = listOpenMedRoles('doctor', new Date('2026-09-02'));
    expect(beforeClose.length).toBeGreaterThan(afterClose.length);
    expect(afterClose.every((r) => r.hiring_closed_from !== '2026-09-01')).toBe(true);
  });

  it('loads source registry with boards + wife TG channels', () => {
    const registry = getMedSourcesRegistry();
    expect(registry.geography_default).toBe('RU');
    expect(listMedSources({ type: 'api' }).map((s) => s.id)).toEqual(
      expect.arrayContaining(['hh.ru', 'superjob.ru'])
    );

    const tgAll = listMedSources({ type: 'tg' });
    expect(tgAll.length).toBeGreaterThanOrEqual(11);
    expect(tgAll.map((s) => s.username)).toEqual(
      expect.arrayContaining([
        'superjob_medicina',
        'rabota_mediki',
        'rabota_medsestra',
        'csorglaborantmladpersonal',
        'hh_vacancy_medicine',
      ])
    );
  });
});
