import { extractHhVacancyMeta, mapHhWorkMode } from '../hhVacancyMeta';

describe('hhVacancyMeta', () => {
  it('extracts HH conditions like on hh.ru card', () => {
    const meta = extractHhVacancyMeta({
      experience: { id: 'moreThan6', name: 'Более 6 лет' },
      employment: { id: 'full', name: 'Полная занятость' },
      employment_form: [
        { id: 'FULL', name: 'Трудовой договор' },
        { id: 'CIVIL_LAW', name: 'Договор ГПХ с ИП' },
      ],
      work_schedule_by_days: [{ id: 'FIVE_ON_TWO_OFF', name: '5/2' }],
      working_hours: [{ id: 'HOURS_8', name: '8' }],
      work_format: [{ id: 'HYBRID', name: 'Гибрид' }],
      schedule: { id: 'fullDay', name: 'Полный день' },
    });

    expect(meta.experienceLabel).toBe('Более 6 лет');
    expect(meta.experienceId).toBe('moreThan6');
    expect(meta.employmentLabel).toBe('Полная занятость');
    expect(meta.employmentId).toBe('full');
    expect(meta.employmentForms).toEqual(['Трудовой договор', 'Договор ГПХ с ИП']);
    expect(meta.employmentFormIds).toEqual(['FULL', 'CIVIL_LAW']);
    expect(meta.workScheduleDays).toBe('5/2');
    expect(meta.workScheduleDayIds).toEqual(['FIVE_ON_TWO_OFF']);
    expect(meta.workingHours).toBe('8');
    expect(meta.workFormatLabel).toBe('Гибрид');
    expect(meta.workFormatIds).toEqual(['HYBRID']);
  });

  it('maps hybrid work_format to internal work_mode', () => {
    expect(
      mapHhWorkMode({
        work_format: [{ id: 'HYBRID', name: 'Гибрид' }],
      })
    ).toBe('hybrid');
  });
});
