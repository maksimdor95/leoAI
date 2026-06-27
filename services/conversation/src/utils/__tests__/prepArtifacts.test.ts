import { appendPrepArtifact, getPrepArtifacts, mergePrepArtifacts } from '../prepArtifacts';

describe('prepArtifacts', () => {
  it('appends and deduplicates artifacts', () => {
    const collected = mergePrepArtifacts({}, { diagnosticsPackComplete: true }, {
      packType: 'diagnostics_map',
      mode: 'diagnostics',
      title: 'Карта пробелов',
      content: 'Пробел: метрики',
    });

    const again = mergePrepArtifacts(collected, {}, {
      packType: 'diagnostics_map',
      mode: 'diagnostics',
      title: 'Карта пробелов',
      content: 'Пробел: метрики',
    });

    expect(getPrepArtifacts(again)).toHaveLength(1);
  });

  it('keeps multiple pack types', () => {
    let collected: Record<string, unknown> = {};
    collected = mergePrepArtifacts(collected, {}, {
      packType: 'rescue_cheatsheet',
      mode: 'case',
      title: 'Разбор',
      content: 'Структура: цель → метрика',
    });
    collected = mergePrepArtifacts(collected, {}, {
      packType: 'theory_cheatsheet',
      mode: 'theory',
      title: 'Урок',
      content: 'B2B метрики',
    });

    const artifacts = getPrepArtifacts(collected);
    expect(artifacts).toHaveLength(2);
    expect(artifacts.map((a) => a.packType)).toEqual(
      expect.arrayContaining(['rescue_cheatsheet', 'theory_cheatsheet'])
    );
  });
});
