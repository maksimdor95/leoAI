import { resolveMedRoleIdFromCollected } from '../chatProfile';
import {
  mapVacancyToMedRole,
  rankMedTaxonomyItemsForPrefill,
  resolveMedTaxonomyForRole,
  MED_UNKNOWN_ROLE_ID,
} from '../index';

describe('chat Med branch → match candidate selection', () => {
  it('returns the role for a confirmed med profile', () => {
    expect(
      resolveMedRoleIdFromCollected({ medRoleId: 'doctor_therapist', medConfirmed: 'да' })
    ).toBe('doctor_therapist');
  });

  it('ignores the role when the candidate declined the med branch', () => {
    expect(
      resolveMedRoleIdFromCollected({ medRoleId: 'doctor_therapist', medConfirmed: 'нет' })
    ).toBeNull();
  });

  it('ignores unknown / empty markers so IT matching is untouched', () => {
    expect(resolveMedRoleIdFromCollected(null)).toBeNull();
    expect(resolveMedRoleIdFromCollected({})).toBeNull();
    expect(resolveMedRoleIdFromCollected({ medRoleId: '' })).toBeNull();
    expect(resolveMedRoleIdFromCollected({ medRoleId: MED_UNKNOWN_ROLE_ID })).toBeNull();
    expect(resolveMedRoleIdFromCollected({ desired_role: 'Product Manager' })).toBeNull();
  });
});

describe('map-role detection contract for the chat', () => {
  it.each([
    'Ищу работу — врач-терапевт участковый',
    'врач-терапевт',
    'медсестра',
    'провизор',
    'старший фельдшер',
  ])('detects a medical role and resolves taxonomy prefill for "%s"', (answer) => {
    const match = mapVacancyToMedRole(answer);
    expect(match.med_role_id).not.toBe(MED_UNKNOWN_ROLE_ID);

    const taxonomy = resolveMedTaxonomyForRole(match.med_role_id, match.title);
    expect(taxonomy).toBeTruthy();
    expect((taxonomy?.skills.length ?? 0) + (taxonomy?.duties.length ?? 0)).toBeGreaterThan(0);
  });

  it('puts profession-specific items above industry-wide ones in the prefill', () => {
    const roles = ['врач-терапевт', 'медсестра'].map((answer) => {
      const match = mapVacancyToMedRole(answer);
      const taxonomy = resolveMedTaxonomyForRole(match.med_role_id, match.title)!;
      return rankMedTaxonomyItemsForPrefill(taxonomy.skills)
        .slice(0, 8)
        .map((item) => item.id);
    });

    // Без ранжирования обе профессии получали один и тот же сквозной блок T01…T08.
    const shared = roles[0].filter((id) => roles[1].includes(id));
    expect(shared.length).toBeLessThan(roles[0].length);
  });

  it('leaves IT roles out of the med branch', () => {
    expect(mapVacancyToMedRole('Senior Product Manager').med_role_id).toBe(MED_UNKNOWN_ROLE_ID);
    expect(mapVacancyToMedRole('Бэкенд-разработчик Node.js').med_role_id).toBe(
      MED_UNKNOWN_ROLE_ID
    );
  });
});
