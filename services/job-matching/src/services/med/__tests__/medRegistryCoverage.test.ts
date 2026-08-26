/**
 * Registry coverage: all active sources are wired into scrapeMed.
 */
import { listActiveMedTgChannels, listMedSources } from '../index';

describe('med full registry wiring', () => {
  it('has no planned sources left — full registry active', () => {
    expect(listMedSources({ status: 'planned' })).toEqual([]);
  });

  it('covers HH + SJ + HTML boards + all TG', () => {
    expect(listMedSources({ type: 'api', status: 'active' }).map((s) => s.id)).toEqual(
      expect.arrayContaining(['hh.ru', 'superjob.ru'])
    );
    expect(listMedSources({ type: 'html', status: 'active' }).map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'rabota.ru',
        'zarplata.ru',
        'avito_jobs',
        'trudvsem.ru',
        'emed.market',
      ])
    );
    expect(listActiveMedTgChannels().length).toBe(12);
  });

  it('HTML boards expose list_urls for ingest', () => {
    for (const board of listMedSources({ type: 'html', status: 'active' })) {
      const urls = [...(board.list_urls || []), board.list_url].filter(Boolean);
      expect(urls.length).toBeGreaterThan(0);
    }
  });
});
