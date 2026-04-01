import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { ReportData } from '../types/report';
import { logger } from '../utils/logger';

// Register Handlebars helpers
Handlebars.registerHelper('scoreColor', (score: number) => {
  if (score >= 8) return '#22c55e'; // green
  if (score >= 6) return '#eab308'; // yellow
  if (score >= 4) return '#f97316'; // orange
  return '#ef4444'; // red
});

Handlebars.registerHelper('formatDate', (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});

Handlebars.registerHelper('scoreBar', (score: number) => {
  const percentage = (score / 10) * 100;
  return `${percentage}%`;
});

// HTML template for the report
const REPORT_TEMPLATE = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PM Interview Report - {{candidateName}}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      background: #ffffff;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #22c55e;
    }
    
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #22c55e;
      margin-bottom: 10px;
    }
    
    .title {
      font-size: 24px;
      color: #1e293b;
      margin-bottom: 5px;
    }
    
    .subtitle {
      color: #64748b;
      font-size: 14px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .profile-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    
    .profile-item {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #22c55e;
    }
    
    .profile-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    
    .profile-value {
      font-size: 16px;
      font-weight: 500;
      color: #1e293b;
    }
    
    .score-card {
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .score-value {
      font-size: 64px;
      font-weight: bold;
      line-height: 1;
    }
    
    .score-label {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 5px;
    }
    
    .category-scores {
      display: grid;
      gap: 15px;
    }
    
    .category-item {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
    }
    
    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .category-name {
      font-weight: 500;
    }
    
    .category-score {
      font-weight: bold;
      padding: 4px 12px;
      border-radius: 20px;
      color: white;
    }
    
    .score-bar-container {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .score-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    
    .category-comment {
      font-size: 13px;
      color: #64748b;
      margin-top: 10px;
    }
    
    .list-section {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
    }
    
    .list-section ul {
      list-style: none;
      padding: 0;
    }
    
    .list-section li {
      padding: 10px 0;
      padding-left: 25px;
      position: relative;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .list-section li:last-child {
      border-bottom: none;
    }
    
    .list-section li::before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #22c55e;
      font-weight: bold;
    }
    
    .strengths li::before {
      content: "✓";
      color: #22c55e;
    }
    
    .improvements li::before {
      content: "→";
      color: #f97316;
    }
    
    .recommendations li::before {
      content: "💡";
    }
    
    .questions li::before {
      content: "❓";
    }
    
    .interview-answer {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      border-left: 4px solid #3b82f6;
    }
    
    .answer-question {
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 10px;
    }
    
    .answer-category {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    
    .answer-text {
      color: #475569;
      font-size: 14px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 12px;
    }
    
    .two-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    @media print {
      .container {
        padding: 20px;
      }
      
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="logo">wannanew</div>
      <h1 class="title">Отчёт по пробному интервью</h1>
      <p class="subtitle">Product Manager · {{formatDate generatedAt}}</p>
    </header>
    
    <section class="section">
      <h2 class="section-title">Профиль кандидата</h2>
      <div class="profile-grid">
        <div class="profile-item">
          <div class="profile-label">Целевой уровень</div>
          <div class="profile-value">{{targetRole}} PM</div>
        </div>
        <div class="profile-item">
          <div class="profile-label">Тип продукта</div>
          <div class="profile-value">{{targetProductType}}</div>
        </div>
      </div>
    </section>
    
    <section class="section">
      <h2 class="section-title">Общая оценка</h2>
      <div class="score-card">
        <div class="score-value">{{evaluation.overallScore}}/10</div>
        <div class="score-label">Общий балл по результатам интервью</div>
      </div>
    </section>
    
    {{#if evaluation.categoryScores.length}}
    <section class="section">
      <h2 class="section-title">Оценка по категориям</h2>
      <div class="category-scores">
        {{#each evaluation.categoryScores}}
        <div class="category-item">
          <div class="category-header">
            <span class="category-name">{{category}}</span>
            <span class="category-score" style="background-color: {{scoreColor score}}">{{score}}/10</span>
          </div>
          <div class="score-bar-container">
            <div class="score-bar" style="width: {{scoreBar score}}; background-color: {{scoreColor score}}"></div>
          </div>
          <div class="category-comment">{{comment}}</div>
        </div>
        {{/each}}
      </div>
    </section>
    {{/if}}
    
    <section class="section">
      <h2 class="section-title">Сильные стороны и зоны роста</h2>
      <div class="two-columns">
        <div class="list-section strengths">
          <h3 style="margin-bottom: 15px; color: #22c55e;">Сильные стороны</h3>
          <ul>
            {{#each evaluation.strengths}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
        </div>
        <div class="list-section improvements">
          <h3 style="margin-bottom: 15px; color: #f97316;">Зоны для развития</h3>
          <ul>
            {{#each evaluation.areasForImprovement}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
        </div>
      </div>
    </section>
    
    {{#if interviewAnswers.length}}
    <section class="section">
      <h2 class="section-title">Ответы на интервью</h2>
      {{#each interviewAnswers}}
      <div class="interview-answer">
        <div class="answer-category">{{category}}</div>
        <div class="answer-question">{{question}}</div>
        <div class="answer-text">{{answer}}</div>
      </div>
      {{/each}}
    </section>
    {{/if}}
    
    <section class="section">
      <h2 class="section-title">Рекомендации по подготовке</h2>
      <div class="list-section recommendations">
        <ul>
          {{#each recommendations}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
    </section>
    
    <section class="section">
      <h2 class="section-title">Типовые вопросы для {{targetRole}} PM</h2>
      <div class="list-section questions">
        <ul>
          {{#each typicalQuestions}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
    </section>
    
    <footer class="footer">
      <p>Отчёт сгенерирован платформой wannanew</p>
      <p>{{formatDate generatedAt}}</p>
    </footer>
  </div>
</body>
</html>
`;

let browserInstance: puppeteer.Browser | null = null;

async function getBrowser(): Promise<puppeteer.Browser> {
  if (!browserInstance) {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      ...(executablePath && { executablePath }),
    });
  }
  return browserInstance;
}

export const pdfGenerator = {
  async generatePdf(reportData: ReportData): Promise<Buffer> {
    logger.info('Generating PDF for report', { targetRole: reportData.targetRole });

    // Compile template
    const template = Handlebars.compile(REPORT_TEMPLATE);
    const html = template(reportData);

    // Launch browser and generate PDF
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      logger.info('PDF generated successfully', { size: pdfBuffer.length });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  },

  async closeBrowser(): Promise<void> {
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }
  },
};

// Cleanup on process exit
process.on('exit', async () => {
  await pdfGenerator.closeBrowser();
});
