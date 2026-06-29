import { uniqueLocationLabels } from '../locationLabels';

describe('uniqueLocationLabels', () => {
  it('removes duplicate city from HH area and address', () => {
    expect(uniqueLocationLabels(['Москва', 'Москва'])).toEqual(['Москва']);
    expect(uniqueLocationLabels(['Москва', 'москва'])).toEqual(['Москва']);
  });

  it('keeps distinct locations', () => {
    expect(uniqueLocationLabels(['Москва', 'Удалённо'])).toEqual(['Москва', 'Удалённо']);
  });
});
