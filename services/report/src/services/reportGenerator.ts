import axios from 'axios';
import { logger } from '../utils/logger';
import {
  CollectedData,
  ReportData,
  ReportEvaluation,
  InterviewAnswer,
  CategoryScore,
} from '../types/report';

const CONVERSATION_SERVICE_URL = process.env.CONVERSATION_SERVICE_URL || 'http://localhost:3002';

// Interview questions mapping
const INTERVIEW_QUESTIONS: Record<string, { question: string; category: string }> = {
  interviewAnswer1: {
    question:
      'Как ты приоритизируешь задачи и фичи в бэклоге? Какие фреймворки используешь и почему?',
    category: 'Приоритизация',
  },
  interviewAnswer2: {
    question:
      'Как ты определяешь, что продукт успешен? Какие метрики отслеживаешь и как принимаешь решения на их основе?',
    category: 'Метрики',
  },
  interviewAnswer3: {
    question:
      'Расскажи о сложной ситуации со стейкхолдерами: конфликт интересов, несогласие по приоритетам. Как ты это разрешил?',
    category: 'Работа со стейкхолдерами',
  },
};

function normalizeTargetRole(raw: string | undefined): keyof typeof TYPICAL_QUESTIONS {
  if (!raw) return 'Middle';
  const lower = String(raw).toLowerCase();
  if (lower.includes('junior')) return 'Junior';
  if (lower.includes('middle')) return 'Middle';
  if (lower.includes('senior')) return 'Senior';
  if (lower.includes('lead')) return 'Lead';
  if (lower.includes('vp') || lower.includes('vice')) return 'VP';
  return 'Middle';
}

// Typical PM interview questions by level
const TYPICAL_QUESTIONS: Record<string, string[]> = {
  Junior: [
    'Расскажи о продукте, над которым ты работал. Какой была твоя роль?',
    'Как ты собираешь и приоритизируешь требования?',
    'Что для тебя значит хороший пользовательский опыт?',
    'Как ты взаимодействуешь с командой разработки?',
    'Опиши ситуацию, когда тебе пришлось принять сложное решение.',
  ],
  Middle: [
    'Как ты определяешь успех продукта?',
    'Расскажи о запуске фичи от идеи до релиза.',
    'Как ты работаешь с техническим долгом?',
    'Как приоритизируешь backlog при ограниченных ресурсах?',
    'Опиши конфликт со стейкхолдерами и как ты его решил.',
  ],
  Senior: [
    'Как ты строишь продуктовую стратегию?',
    'Расскажи о продукте, который ты вырастил с нуля.',
    'Как ты принимаешь решения о отказе от фичи или продукта?',
    'Как выстраиваешь работу с несколькими командами?',
    'Как ты развиваешь продуктовую культуру в компании?',
  ],
  Lead: [
    'Как ты формируешь и развиваешь продуктовую команду?',
    'Расскажи о трансформации продукта или компании под твоим руководством.',
    'Как балансируешь краткосрочные и долгосрочные цели?',
    'Как ты работаешь с C-level менеджментом?',
    'Как определяешь product-market fit для нового продукта?',
  ],
  VP: [
    'Как ты выстраиваешь продуктовую организацию в масштабе?',
    'Расскажи о стратегическом повороте продукта.',
    'Как ты работаешь с советом директоров и инвесторами?',
    'Как формируешь долгосрочное видение продуктового портфеля?',
    'Как ты оцениваешь M&A возможности с продуктовой точки зрения?',
  ],
};

export type GenerateReportDataOptions = {
  /** Bearer-токен пользователя — нужен для GET /api/chat/session (иначе conversation не отдаёт сессию). */
  authorization?: string;
};

export const reportGenerator = {
  /**
   * Сборка отчёта из уже известных полей сессии (без HTTP к conversation) — для превью из chat-сервиса.
   */
  buildReportDataFromCollected(collectedData: CollectedData, email?: string): ReportData {
    logger.info('Building report from collected data', { keys: Object.keys(collectedData) });

    const interviewAnswers = this.extractInterviewAnswers(collectedData);
    const evaluation = this.generateEvaluation(collectedData, interviewAnswers);
    const targetRoleKey = normalizeTargetRole(collectedData.targetRole);
    const typicalQuestions = TYPICAL_QUESTIONS[targetRoleKey] || TYPICAL_QUESTIONS.Middle;
    const targetRole = collectedData.targetRole || targetRoleKey;
    const recommendations = this.generateRecommendations(evaluation, targetRoleKey);

    return {
      candidateName: email?.split('@')[0] || 'Кандидат',
      email,
      targetRole,
      targetProductType: collectedData.targetProductType || 'B2C',
      experience: collectedData.resumeOrIntro || 'Не указан',
      pmCase: collectedData.pmCase || 'Не указан',
      interviewAnswers,
      evaluation,
      recommendations,
      typicalQuestions,
      generatedAt: new Date().toISOString(),
    };
  },

  async generateReportData(
    sessionId: string,
    userId: string,
    email?: string,
    fetchOptions?: GenerateReportDataOptions
  ): Promise<ReportData> {
    const sessionData = await this.fetchSessionData(sessionId, fetchOptions);
    const collectedData = (sessionData.metadata?.collectedData || {}) as CollectedData;
    return this.buildReportDataFromCollected(collectedData, email);
  },

  async fetchSessionData(
    sessionId: string,
    options?: GenerateReportDataOptions
  ): Promise<any> {
    try {
      const headers: Record<string, string> = {};
      if (options?.authorization) {
        const a = options.authorization.trim();
        headers.Authorization = a.startsWith('Bearer ') ? a : `Bearer ${a}`;
      } else {
        headers['X-Internal-Service'] = 'report-service';
      }
      const response = await axios.get(
        `${CONVERSATION_SERVICE_URL}/api/chat/session/${sessionId}`,
        {
          headers,
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch session data', { sessionId, error: (error as Error).message });
      // С пользовательским токеном не подставляем пустые данные — вызывающий код вернёт 404.
      if (options?.authorization) {
        throw error;
      }
      return { metadata: { collectedData: {} } };
    }
  },

  extractInterviewAnswers(collectedData: CollectedData): InterviewAnswer[] {
    const answers: InterviewAnswer[] = [];

    for (const [key, config] of Object.entries(INTERVIEW_QUESTIONS)) {
      const answer = collectedData[key];
      if (answer) {
        answers.push({
          question: config.question,
          answer,
          category: config.category,
        });
      }
    }

    return answers;
  },

  generateEvaluation(collectedData: CollectedData, interviewAnswers: InterviewAnswer[]): ReportEvaluation {
    // Simple evaluation logic based on answer length and keywords
    const categoryScores: CategoryScore[] = [];
    let totalScore = 0;
    const strengths: string[] = [];
    const areasForImprovement: string[] = [];

    for (const answer of interviewAnswers) {
      const score = this.evaluateAnswer(answer.answer);
      categoryScores.push({
        category: answer.category,
        score,
        comment: this.getScoreComment(score, answer.category),
      });
      totalScore += score;

      if (score >= 7) {
        strengths.push(answer.category);
      } else if (score < 5) {
        areasForImprovement.push(answer.category);
      }
    }

    // Evaluate PM case
    const caseScore = this.evaluateAnswer(collectedData.pmCase || '');
    if (caseScore >= 7) {
      strengths.push('Продуктовый кейс');
    } else if (caseScore < 5) {
      areasForImprovement.push('Описание продуктового опыта');
    }

    const overallScore = interviewAnswers.length > 0
      ? Math.round(totalScore / interviewAnswers.length)
      : 5;

    // Add generic feedback if arrays are empty
    if (strengths.length === 0) {
      strengths.push('Готовность проходить интервью', 'Структурированный подход');
    }
    if (areasForImprovement.length === 0) {
      areasForImprovement.push('Детализация ответов', 'Добавление конкретных примеров');
    }

    return {
      overallScore,
      categoryScores,
      strengths,
      areasForImprovement,
    };
  },

  evaluateAnswer(answer: string): number {
    if (!answer || answer.length < 20) return 3;
    if (answer.length < 50) return 4;
    if (answer.length < 100) return 5;
    if (answer.length < 200) return 6;
    if (answer.length < 400) return 7;
    if (answer.length < 600) return 8;
    return 9;
  },

  getScoreComment(score: number, category: string): string {
    if (score >= 8) return `Отличное понимание ${category.toLowerCase()}`;
    if (score >= 6) return `Хороший уровень в области ${category.toLowerCase()}`;
    if (score >= 4) return `Базовое понимание ${category.toLowerCase()}, есть потенциал для роста`;
    return `Рекомендуется углубить знания в области ${category.toLowerCase()}`;
  },

  generateRecommendations(evaluation: ReportEvaluation, targetRole: string): string[] {
    const recommendations: string[] = [];

    // Based on overall score
    if (evaluation.overallScore < 5) {
      recommendations.push('Рекомендуем пройти курс по основам Product Management');
      recommendations.push('Изучите фреймворки приоритизации (RICE, ICE, MoSCoW)');
    } else if (evaluation.overallScore < 7) {
      recommendations.push('Подготовьте 3-5 детальных кейсов из своего опыта');
      recommendations.push('Потренируйтесь структурировать ответы по методу STAR');
    } else {
      recommendations.push('Фокусируйтесь на стратегических аспектах в ответах');
      recommendations.push('Готовьте вопросы для интервьюера о компании и продукте');
    }

    // Based on areas for improvement
    for (const area of evaluation.areasForImprovement) {
      if (area.includes('Приоритизация')) {
        recommendations.push('Изучите методологии приоритизации: RICE, Kano, Story Mapping');
      }
      if (area.includes('Метрики')) {
        recommendations.push('Разберите пирамиду метрик (AARRR, NSM, Health metrics)');
      }
      if (area.includes('стейкхолдер')) {
        recommendations.push('Практикуйте техники переговоров и управления конфликтами');
      }
    }

    // Role-specific recommendations
    if (targetRole === 'Senior' || targetRole === 'Lead' || targetRole === 'VP') {
      recommendations.push('Подготовьте примеры влияния на бизнес-метрики');
      recommendations.push('Продумайте ваше видение развития продукта на 2-3 года');
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  },
};
