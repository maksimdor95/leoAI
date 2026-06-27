import Handlebars from 'handlebars';
import { InterviewPrepReportData } from '../types/interviewPrepReport';
import { pdfGenerator } from './pdfGenerator';

Handlebars.registerHelper('formatPrepDate', (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});

Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
Handlebars.registerHelper('lt', (a: number, b: number) => a < b);

const INTERVIEW_PREP_TEMPLATE = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>LEO Interview — Отчёт подготовки</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; color: #1e293b; line-height: 1.55; margin: 0; }
    .page { max-width: 760px; margin: 0 auto; padding: 32px 28px; }
    h1 { font-size: 22px; margin: 0 0 6px; color: #14532d; }
    h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 2px solid #dcfce7; padding-bottom: 6px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
    .summary-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { background: #f8fafc; border-radius: 8px; padding: 12px; border-left: 4px solid #22c55e; }
    ul { margin: 8px 0 0 18px; padding: 0; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
    th { background: #f1f5f9; }
    .check-done { color: #15803d; }
    .check-todo { color: #94a3b8; }
    .muted { color: #64748b; font-size: 12px; }
    .delta-up { color: #15803d; font-weight: 600; }
    .delta-down { color: #b45309; font-weight: 600; }
    .delta-flat { color: #64748b; }
    .gap-closed { color: #15803d; }
    .gap-remain { color: #b45309; }
    .gap-new { color: #1d4ed8; }
  </style>
</head>
<body>
  <div class="page">
    <h1>LEO Interview — Отчёт подготовки</h1>
    <div class="meta">{{role}} · {{level}} · {{company}}<br/>{{formatPrepDate generatedAt}} · {{sessionId}}</div>

    <div class="summary-box">
      <strong>Готовность: {{readinessPercent}}% — {{readinessStatus}}</strong>
      <div class="grid" style="margin-top:12px">
        <div>
          <div class="muted">Сильные стороны</div>
          <ul>{{#each executiveSummary.strengths}}<li>{{this}}</li>{{/each}}</ul>
        </div>
        <div>
          <div class="muted">Приоритетные пробелы</div>
          <ul>{{#each executiveSummary.gaps}}<li>{{this}}</li>{{/each}}</ul>
        </div>
      </div>
      <div style="margin-top:10px">
        <div class="muted">3 действия до собеседования</div>
        <ul>{{#each executiveSummary.actions}}<li>{{this}}</li>{{/each}}</ul>
      </div>
    </div>

    {{#if progressComparison}}
    <h2>1.1. Было / стало (сессия #2+)</h2>
    <div class="card">
      <div><strong>Прошлая подготовка:</strong> {{progressComparison.priorRole}}{{#if progressComparison.priorLevel}} · {{progressComparison.priorLevel}}{{/if}}</div>
      <div style="margin-top:8px">
        <strong>Готовность:</strong>
        {{progressComparison.priorReadinessPercent}}% → {{progressComparison.currentReadinessPercent}}%
        {{#if (gt progressComparison.readinessDelta 0)}}
          <span class="delta-up">(+{{progressComparison.readinessDelta}})</span>
        {{else}}{{#if (lt progressComparison.readinessDelta 0)}}
          <span class="delta-down">({{progressComparison.readinessDelta}})</span>
        {{else}}
          <span class="delta-flat">(без изменений)</span>
        {{/if}}{{/if}}
      </div>
    </div>
    {{#if progressComparison.competencyDeltas.length}}
    <table style="margin-top:12px">
      <tr><th>Измерение</th><th>Было</th><th>Стало</th><th>Δ</th></tr>
      {{#each progressComparison.competencyDeltas}}
      <tr>
        <td>{{label}}</td>
        <td>{{#if priorScore}}{{priorScore}}{{else}}—{{/if}}</td>
        <td>{{currentScore}}</td>
        <td>
          {{#if delta}}{{#if (gt delta 0)}}<span class="delta-up">+{{delta}}</span>{{else}}{{#if (lt delta 0)}}<span class="delta-down">{{delta}}</span>{{else}}0{{/if}}{{/if}}{{else}}—{{/if}}
        </td>
      </tr>
      {{/each}}
    </table>
    {{/if}}
    <div class="grid" style="margin-top:12px">
      <div>
        <div class="muted">Закрытые пробелы</div>
        <ul>{{#each progressComparison.closedGaps}}<li class="gap-closed">{{this}}</li>{{/each}}{{#unless progressComparison.closedGaps.length}}<li class="muted">Пока нет</li>{{/unless}}</ul>
      </div>
      <div>
        <div class="muted">Остались / новые</div>
        <ul>
          {{#each progressComparison.remainingGaps}}<li class="gap-remain">{{this}}</li>{{/each}}
          {{#each progressComparison.newGaps}}<li class="gap-new">{{this}}</li>{{/each}}
          {{#unless progressComparison.remainingGaps.length}}{{#unless progressComparison.newGaps.length}}<li class="muted">Без изменений</li>{{/unless}}{{/unless}}
        </ul>
      </div>
    </div>
    {{/if}}

    <h2>2. Профиль вакансии</h2>
    <div class="card">
      <div><strong>Роль:</strong> {{vacancyProfile.role}}</div>
      <div><strong>Уровень:</strong> {{vacancyProfile.level}}</div>
      <div><strong>Домен:</strong> {{vacancyProfile.domain}}</div>
      {{#if vacancyProfile.stack}}<div><strong>Стек:</strong> {{vacancyProfile.stack}}</div>{{/if}}
    </div>
    {{#if vacancyProfile.requirements}}
    <div style="margin-top:10px"><strong>Ключевые компетенции</strong><ul>{{#each vacancyProfile.requirements}}<li>{{this}}</li>{{/each}}</ul></div>
    {{/if}}

    <h2>3. Карта компетенций</h2>
    {{#if competencyScores.length}}
    <table>
      <tr><th>Измерение</th><th>Средняя оценка</th></tr>
      {{#each competencyScores}}<tr><td>{{label}}</td><td>{{score}} / 10</td></tr>{{/each}}
    </table>
    {{else}}<p class="muted">Оценки появятся после диагностики и мок-интервью.</p>{{/if}}

    <h2>4. Топ-пробелы</h2>
    <ul>{{#each fatalGaps}}<li>{{this}}</li>{{/each}}</ul>

    {{#if starStories.length}}
    <h2>5. STAR-истории</h2>
    {{#each starStories}}<div class="card" style="margin-bottom:8px"><strong>{{title}}</strong><div>{{structure}}</div></div>{{/each}}
    {{/if}}

    {{#if caseStructures.length}}
    <h2>6. Кейсы — эталонные структуры</h2>
    <ul>{{#each caseStructures}}<li>{{this}}</li>{{/each}}</ul>
    {{/if}}

    {{#if mockSummary}}
    <h2>7. Итог мок-интервью</h2>
    <div class="card" style="white-space:pre-line">{{mockSummary}}</div>
    {{/if}}

    {{#if cheatsheets.length}}
    <h2>7. Шпаргалки (Learn + Rescue)</h2>
    {{#each cheatsheets}}
    <div class="card" style="margin-bottom:8px">
      <strong>{{title}}</strong>
      <div style="white-space:pre-line;margin-top:6px">{{content}}</div>
    </div>
    {{/each}}
    {{/if}}

    {{#if employerQuestions.length}}
    <h2>8. Вопросы работодателю</h2>
    <ul>{{#each employerQuestions}}<li>{{this}}</li>{{/each}}</ul>
    {{/if}}

    <h2>9. Чеклист готовности</h2>
    <ul>
      {{#each checklist}}
      <li class="{{#if done}}check-done{{else}}check-todo{{/if}}">{{#if done}}✓{{else}}○{{/if}} {{label}}</li>
      {{/each}}
    </ul>

    {{#if dayProgress.length}}
    <h2>10. Прогресс по дням</h2>
    <table>
      <tr><th>День</th><th>Фокус</th><th>Статус</th></tr>
      {{#each dayProgress}}<tr><td>{{day}}</td><td>{{focus}}</td><td>{{#if done}}✓{{else}}○{{/if}}</td></tr>{{/each}}
    </table>
    {{/if}}
  </div>
</body>
</html>
`;

export const interviewPrepPdfGenerator = {
  async generatePdf(data: InterviewPrepReportData): Promise<Buffer> {
    const template = Handlebars.compile(INTERVIEW_PREP_TEMPLATE);
    const html = template({
      ...data,
      vacancyProfile: {
        ...data.vacancyProfile,
        stack: data.vacancyProfile.stack?.join(', '),
        requirements: (data.vacancyProfile.requirements ?? []).slice(0, 7),
      },
    });
    return pdfGenerator.generatePdfFromHtml(html, `interview-prep:${data.sessionId}`);
  },
};
