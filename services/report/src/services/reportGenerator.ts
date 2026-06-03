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

// Interview questions mapping (role-agnostic — соответствует шагам сценария wannanew)
const INTERVIEW_QUESTIONS: Record<string, { question: string; category: string }> = {
  interviewAnswer1: {
    question: 'Ключевые навыки и опыт, релевантные целевой позиции.',
    category: 'Ключевые компетенции',
  },
  interviewAnswer2: {
    question: 'Сложная рабочая ситуация и как кандидат её решил.',
    category: 'Рабочая ситуация',
  },
  interviewAnswer3: {
    question: 'Мотивация кандидата и соответствие позиции.',
    category: 'Мотивация и соответствие',
  },
};

/** Универсальные вопросы для подготовки к собеседованию на любую роль. */
const TYPICAL_QUESTIONS: string[] = [
  'Расскажите о себе и почему вас заинтересовала эта позиция.',
  'Какие ваши сильные стороны делают вас подходящим кандидатом на эту роль?',
  'Опишите сложную рабочую ситуацию и то, как вы её решили.',
  'Приведите пример достижения, которым вы гордитесь, и вашу роль в нём.',
  'Какие вопросы вы бы задали работодателю об этой позиции и компании?',
];

/**
 * Человекочитаемое название позиции для отчёта.
 * Приоритет: явно названная позиция -> уровень/грейд -> общий фолбэк.
 */
function resolvePositionTitle(collectedData: CollectedData): string {
  const position = collectedData.targetPosition?.trim();
  if (position) return position;
  const role = collectedData.targetRole?.trim();
  if (role) return role;
  return 'выбранную позицию';
}

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
    const positionTitle = resolvePositionTitle(collectedData);
    const typicalQuestions = TYPICAL_QUESTIONS;
    const targetRole = collectedData.targetRole || positionTitle;
    const recommendations = this.generateRecommendations(evaluation);

    return {
      candidateName: email?.split('@')[0] || 'Кандидат',
      email,
      positionTitle,
      targetRole,
      targetProductType: collectedData.targetProductType || 'Не указано',
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

    // Evaluate key case / relevant experience
    const caseScore = this.evaluateAnswer(collectedData.pmCase || '');
    if (caseScore >= 7) {
      strengths.push('Релевантный кейс');
    } else if (caseScore < 5) {
      areasForImprovement.push('Описание релевантного опыта');
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

  generateRecommendations(evaluation: ReportEvaluation): string[] {
    const recommendations: string[] = [];

    // Based on overall score
    if (evaluation.overallScore < 5) {
      recommendations.push('Изучите ключевые требования и навыки для целевой позиции');
      recommendations.push('Подготовьте короткий рассказ о себе и своём опыте под эту роль');
    } else if (evaluation.overallScore < 7) {
      recommendations.push('Подготовьте 3-5 детальных примеров из своего опыта');
      recommendations.push('Потренируйтесь структурировать ответы по методу STAR');
    } else {
      recommendations.push('Подчёркивайте измеримые результаты и свой вклад в ответах');
      recommendations.push('Подготовьте вопросы для интервьюера о позиции и компании');
    }

    // Based on areas for improvement
    for (const area of evaluation.areasForImprovement) {
      if (area.includes('Ключевые компетенции')) {
        recommendations.push('Систематизируйте ключевые навыки и подкрепите их примерами');
      }
      if (area.includes('Рабочая ситуация')) {
        recommendations.push('Подготовьте кейсы по методу STAR: ситуация, задача, действия, результат');
      }
      if (area.includes('Мотивация')) {
        recommendations.push('Сформулируйте, почему вам интересна эта позиция и компания');
      }
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  },
};
