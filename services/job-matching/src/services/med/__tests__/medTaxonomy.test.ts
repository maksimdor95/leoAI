import {
  countSharedDictionary,
  getMedTaxonomyCatalog,
  getMedTaxonomyDisclaimer,
  getTaxonomyByMedRoleId,
  getTaxonomyBySourceTitle,
  listTaxonomiesForLevel,
} from '../taxonomy';

describe('med/taxonomy Phase 2', () => {
  it('loads catalog with shared dictionary and professions', () => {
    const cat = getMedTaxonomyCatalog();
    expect(cat.version).toBe(1);
    expect(cat.stats.professions).toBe(181);
    expect(countSharedDictionary()).toBeGreaterThanOrEqual(100);
    expect(cat.disclaimer.length).toBeGreaterThan(40);
    expect(getMedTaxonomyDisclaimer()).toContain('Минздрава');
  });

  it('resolves doctor taxonomy with skills + duties', () => {
    const entry = getMedTaxonomyCatalog().roles.find(
      (r) => r.level === 'doctor' && /терапевт/i.test(r.source_title) && !/психо|физио|радио/i.test(r.source_title)
    );
    expect(entry).toBeTruthy();
    const resolved = getTaxonomyBySourceTitle(entry!.source_title);
    expect(resolved).toBeTruthy();
    expect(resolved!.skills.length).toBeGreaterThan(5);
    expect(resolved!.duties.length).toBeGreaterThan(3);
    expect(resolved!.provenance).toBe('official');
    expect(resolved!.disclaimer).toBeTruthy();
  });

  it('resolves nurse (mid) and allows shared skill codes across roles', () => {
    const nurse = getTaxonomyBySourceTitle('медицинская сестра');
    expect(nurse).toBeTruthy();
    expect(nurse!.level).toBe('mid');
    expect(nurse!.med_role_id).toBe('mid_medicinskaya_sestra_medicinskij_brat');
    expect(nurse!.skills.length).toBeGreaterThan(10);

    const doctor = listTaxonomiesForLevel('doctor')[0];
    expect(doctor).toBeTruthy();
    const shared = nurse!.skills.some((s) => doctor!.skills.some((d) => d.id === s.id));
    expect(shared).toBe(true);
  });

  it('looks up by med_role_id when mapped', () => {
    const byId = getTaxonomyByMedRoleId('mid_medicinskaya_sestra_medicinskij_brat');
    expect(byId?.source_title).toBe('медицинская сестра');
  });

  it('maps pharma / leadership / junior extras to med_role_id (unmapped=0)', () => {
    const cat = getMedTaxonomyCatalog();
    expect(cat.stats.unmapped).toBe(0);
    expect(cat.stats.mapped_to_med_role).toBe(181);

    expect(getTaxonomyBySourceTitle('провизор')?.med_role_id).toBe('doctor_provizor');
    expect(getTaxonomyBySourceTitle('фармацевт')?.med_role_id).toBe('mid_farmacevt');
    expect(getTaxonomyBySourceTitle('главный врач')?.med_role_id).toBe('doctor_glavnyj_vrach');
    expect(getTaxonomyBySourceTitle('сиделка')?.med_role_id).toBe('junior_sidelka');
    expect(getTaxonomyBySourceTitle('санитар-водитель')?.med_role_id).toBe('junior_sanitar_voditel');
  });

  it('covers doctors and mid (nurses) layers', () => {
    expect(listTaxonomiesForLevel('doctor').length).toBeGreaterThanOrEqual(100);
    expect(listTaxonomiesForLevel('mid').length).toBeGreaterThanOrEqual(30);
    expect(listTaxonomiesForLevel('junior').length).toBeGreaterThanOrEqual(10);
  });
});
