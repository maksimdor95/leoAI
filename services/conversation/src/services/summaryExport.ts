import { generateMarkdownPdfBuffer, generateResumeDocxBuffer } from './resumeExport';

export type ProfileSummaryExport = {
  professionalSummary: string;
  score: number;
  scoreBreakdown: Array<{
    criterion: string;
    score: number;
    maxScore: number;
    comment: string;
  }>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export function profileSummaryToMarkdown(summary: ProfileSummaryExport): string {
  const lines: string[] = [
    `## Оценка профиля: ${summary.score}/10`,
    '',
    summary.professionalSummary,
    '',
    '## Оценка по критериям RQG',
    '',
  ];

  for (const item of summary.scoreBreakdown) {
    const comment = item.comment ? ` — ${item.comment}` : '';
    lines.push(`### ${item.criterion} (${item.score}/${item.maxScore})${comment}`);
    lines.push('');
  }

  if (summary.strengths.length > 0) {
    lines.push('## Сильные стороны', '');
    for (const item of summary.strengths) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  if (summary.weaknesses.length > 0) {
    lines.push('## Зоны роста', '');
    for (const item of summary.weaknesses) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  if (summary.recommendations.length > 0) {
    lines.push('## Рекомендации', '');
    for (const item of summary.recommendations) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export async function generateSummaryPdfBuffer(summary: ProfileSummaryExport): Promise<Buffer> {
  return generateMarkdownPdfBuffer({
    title: 'Профессиональная оценка',
    markdown: profileSummaryToMarkdown(summary),
  });
}

export async function generateSummaryDocxBuffer(summary: ProfileSummaryExport): Promise<Buffer> {
  const markdown = `# Профессиональная оценка\n\n${profileSummaryToMarkdown(summary)}`;
  return generateResumeDocxBuffer(markdown);
}

export function parseProfileSummaryDraft(raw: unknown): ProfileSummaryExport | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && 'professionalSummary' in raw) {
    return raw as ProfileSummaryExport;
  }
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as ProfileSummaryExport;
    return parsed?.professionalSummary ? parsed : null;
  } catch {
    return null;
  }
}
