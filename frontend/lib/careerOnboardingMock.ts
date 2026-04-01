/**
 * API helpers for AI Career Learning Platform onboarding (Stage 1).
 * These call backend endpoints in User Profile Service.
 */

import api from './api';

export type CareerBasicsPayload = {
  currentRole: string;
  experienceYears: number;
  targetRole: string;
};

export type ResumePayload = {
  resumeText: string;
};

export type InterviewAnswer = {
  questionId: string;
  answer: string;
};

export type AiReadinessScore = {
  score: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  summary: string;
  recommendations: string[];
};

export async function saveCareerBasics(data: CareerBasicsPayload): Promise<{ success: boolean }> {
  await api.post('/api/career/profile', {
    current_role: data.currentRole,
    target_role: data.targetRole,
    experience_years: data.experienceYears,
  });
  return { success: true };
}

export async function saveResume(payload: ResumePayload): Promise<{ success: boolean }> {
  await api.post('/api/career/profile', {
    resume_text: payload.resumeText,
  });
  return { success: true };
}

export async function submitInterviewAnswers(
  answers: InterviewAnswer[]
): Promise<{ success: boolean }> {
  // For now we don't persist interview answers in backend; they will be used later
  // eslint-disable-next-line no-console
  console.log('[career] interview answers (client-side only for now)', answers);
  return { success: true };
}

export async function fetchAiReadinessScore(): Promise<AiReadinessScore> {
  const response = await api.get<{
    ai_readiness_score: number;
    summary: string;
    recommendations: string[];
  }>('/api/career/ai-readiness');

  const rawScore = response.data.ai_readiness_score ?? 0;

  let level: AiReadinessScore['level'] = 'beginner';
  if (rawScore >= 70) {
    level = 'advanced';
  } else if (rawScore >= 40) {
    level = 'intermediate';
  }

  return {
    score: rawScore,
    level,
    summary: response.data.summary,
    recommendations: response.data.recommendations,
  };
}

