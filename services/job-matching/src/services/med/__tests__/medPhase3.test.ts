import {
  validateMedSpecialistInput,
  CONSENT_A_VERSION,
  MED_EMPLOYMENT_TYPES,
} from '../specialists';

describe('med/specialists Phase 3 validation', () => {
  it('requires consent_a and known role', () => {
    const missing = validateMedSpecialistInput({
      med_role_id: 'doctor_vrach_terapevt',
      consent_a: false,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('CONSENT_A_REQUIRED');

    const unknown = validateMedSpecialistInput({
      med_role_id: 'no_such_role',
      consent_a: true,
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('ROLE_UNKNOWN');
  });

  it('accepts completed profile payload for pharma / leadership / junior', () => {
    for (const roleId of [
      'doctor_provizor',
      'doctor_glavnyj_vrach',
      'junior_sidelka',
      'mid_farmacevt',
    ]) {
      const ok = validateMedSpecialistInput({
        med_role_id: roleId,
        skill_ids: ['S01'],
        duty_ids: ['D01'],
        experience_text: '5 лет',
        documents_text: 'аккредитация 2024',
        city: 'Москва',
        employment_type: 'permanent',
        consent_a: true,
        session_id: 'test-session',
      });
      expect(ok.ok).toBe(true);
      if (ok.ok) {
        expect(ok.value.med_role_id).toBe(roleId);
        expect(ok.value.consent_a).toBe(true);
        expect(ok.value.employment_type).toBe('permanent');
      }
    }
  });

  it('rejects invalid employment_type', () => {
    const bad = validateMedSpecialistInput({
      med_role_id: 'doctor_vrach_terapevt',
      consent_a: true,
      employment_type: 'freelance_xyz',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('EMPLOYMENT_INVALID');
  });

  it('exposes consent version and employment enum', () => {
    expect(CONSENT_A_VERSION).toMatch(/^med-a-/);
    expect(MED_EMPLOYMENT_TYPES).toEqual(
      expect.arrayContaining(['permanent', 'combination', 'side_job', 'temporary'])
    );
  });
});
