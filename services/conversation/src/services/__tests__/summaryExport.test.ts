import { generateSummaryPdfBuffer, profileSummaryToMarkdown } from '../summaryExport';

describe('summaryExport', () => {
  const sampleSummary = {
    professionalSummary:
      '9 лет опыта в психологии: школьный психолог, корпоративный wellbeing в IT.',
    score: 9,
    scoreBreakdown: [
      {
        criterion: 'Желаемая должность',
        score: 2,
        maxScore: 2,
        comment: 'Чётко указана целевая роль',
      },
    ],
    strengths: ['Структурированный опыт'],
    weaknesses: ['Нет информации о языках'],
    recommendations: ['Добавить языки'],
  };

  it('builds markdown with score and sections', () => {
    const markdown = profileSummaryToMarkdown(sampleSummary);
    expect(markdown).toContain('Оценка профиля: 9/10');
    expect(markdown).toContain('## Сильные стороны');
    expect(markdown).toContain('Желаемая должность');
  });

  it('generates PDF with Cyrillic content', async () => {
    const buffer = await generateSummaryPdfBuffer(sampleSummary);
    expect(buffer.length).toBeGreaterThan(4000);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.toString('latin1')).toContain('DejaVuSans');
  });
});
