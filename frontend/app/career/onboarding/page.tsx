'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Layout, Typography, message, Spin } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { isAuthenticated } from '@/lib/auth';
import { OnboardingStepper, OnboardingStepKey } from '@/components/career/OnboardingStepper';
import {
  WelcomeStep,
  CareerQuestionStep,
  ResumeUploadStep,
  ResumeInterviewStep,
  ReadinessScoreStep,
} from '@/components/career/Steps';
import {
  CareerBasicsPayload,
  fetchAiReadinessScore,
  saveCareerBasics,
  saveResume,
  submitInterviewAnswers,
} from '@/lib/careerOnboardingMock';
import {
  readCareerOnboardingProgress,
  saveCareerOnboardingProgress,
} from '@/lib/careerOnboardingProgress';
import { uploadResumeFile } from '@/lib/resumeProfileImport';

const { Content } = Layout;
const { Title, Text } = Typography;

type InterviewAnswersState = Record<string, string>;

export default function CareerOnboardingPage() {
  const router = useRouter();
  const { openAuthModal } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStepKey>('welcome');
  const [loading, setLoading] = useState(false);
  const [careerBasics, setCareerBasics] = useState<CareerBasicsPayload>({
    currentRole: '',
    experienceYears: 0,
    targetRole: '',
  });
  const [resumeText, setResumeText] = useState('');
  const [interviewAnswers, setInterviewAnswers] = useState<InterviewAnswersState>({});
  const [scoreData, setScoreData] = useState<{
    score: number;
    levelLabel: string;
    summary: string;
    recommendations: string[];
  } | null>(null);

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!isAuthenticated()) {
      messageApi.warning('Войдите или зарегистрируйтесь, чтобы пройти онбординг.');
      openAuthModal('login');
      router.replace('/');
      return;
    }

    const savedProgress = readCareerOnboardingProgress();
    if (savedProgress && !savedProgress.completed) {
      setCurrentStep(savedProgress.step);
    }
  }, [router, openAuthModal, messageApi]);

  useEffect(() => {
    setScoreData(null);
  }, [currentStep]);

  useEffect(() => {
    saveCareerOnboardingProgress({
      step: currentStep,
      updatedAt: new Date().toISOString(),
      completed: currentStep === 'readinessScore',
    });
  }, [currentStep]);

  const handleSaveCareerField = async (field: keyof CareerBasicsPayload, value: string | number) => {
    const updated: CareerBasicsPayload = {
      ...careerBasics,
      [field]: value,
    };
    setCareerBasics(updated);

    try {
      setLoading(true);
      await saveCareerBasics(updated);
      if (field === 'currentRole') {
        setCurrentStep('experienceYears');
      } else if (field === 'experienceYears') {
        setCurrentStep('careerGoal');
      } else if (field === 'targetRole') {
        setCurrentStep('resume');
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Не удалось сохранить данные';
      messageApi.error(text);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const { extractedText } = await uploadResumeFile(file);
      setResumeText(extractedText);
      messageApi.success('Текст резюме извлечён из файла');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Не удалось загрузить файл';
      messageApi.error(text);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleResumeSubmit = async () => {
    try {
      setLoading(true);
      if (resumeText.trim()) {
        await saveResume({ resumeText });
      }
      setCurrentStep('interview');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Не удалось сохранить резюме';
      messageApi.error(text);
    } finally {
      setLoading(false);
    }
  };

  const handleNoResume = () => {
    setResumeText('');
    setCurrentStep('interview');
  };

  const handleChangeInterviewAnswer = (questionId: string, value: string) => {
    setInterviewAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleInterviewSubmit = async () => {
    try {
      setLoading(true);
      const answersArray = Object.entries(interviewAnswers)
        .filter(([, answer]) => answer.trim().length > 0)
        .map(([questionId, answer]) => ({ questionId, answer }));

      if (answersArray.length > 0) {
        await submitInterviewAnswers(answersArray);
      }

      const result = await fetchAiReadinessScore();
      const levelLabel =
        result.level === 'beginner'
          ? 'Начальный уровень'
          : result.level === 'advanced'
            ? 'Продвинутый уровень'
            : 'Уверенный уровень';

      setScoreData({
        score: result.score,
        levelLabel,
        summary: result.summary,
        recommendations: result.recommendations,
      });
      setCurrentStep('readinessScore');
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : 'Не удалось получить AI Readiness Score. Попробуйте позже.';
      messageApi.error(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout className="min-h-screen bg-[#050913] text-white">
      {contextHolder}
      <Content className="flex flex-col h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[1400px] flex-1 flex flex-col gap-6 sm:gap-8">
          <header className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-2 sm:gap-3">
                <Text className="text-xs uppercase tracking-[0.35em] text-green-300/80">
                  Stage 1 · AI Career Learning
                </Text>
                <Title
                  level={2}
                  className="!m-0 !text-white text-2xl sm:text-3xl lg:text-4xl leading-tight"
                >
                  AI Career Onboarding
                </Title>
                <Text className="text-sm sm:text-base text-slate-300 max-w-2xl">
                  Мы зададим несколько вопросов про вашу карьеру, опыт и цели, попросим резюме или
                  проведём короткое интервью — и покажем первый AI Readiness Score.
                </Text>
              </div>
              <Link href="/chats" className="shrink-0">
                <Button type="text" className="!text-slate-200 hover:!text-white">
                  Мои чаты
                </Button>
              </Link>
            </div>
          </header>

          <OnboardingStepper currentStep={currentStep} />

          <main className="flex-1">
            {loading && currentStep === 'readinessScore' && !scoreData ? (
              <div className="flex h-64 items-center justify-center">
                <Spin size="large" />
              </div>
            ) : null}

            {currentStep === 'welcome' && (
              <WelcomeStep
                onNext={() => {
                  setCurrentStep('currentRole');
                }}
              />
            )}

            {currentStep === 'currentRole' && (
              <CareerQuestionStep
                initialValues={careerBasics}
                field="currentRole"
                loading={loading}
                onSubmit={(value) => handleSaveCareerField('currentRole', value)}
              />
            )}

            {currentStep === 'experienceYears' && (
              <CareerQuestionStep
                initialValues={careerBasics}
                field="experienceYears"
                loading={loading}
                onSubmit={(value) => handleSaveCareerField('experienceYears', value)}
              />
            )}

            {currentStep === 'careerGoal' && (
              <CareerQuestionStep
                initialValues={careerBasics}
                field="targetRole"
                loading={loading}
                onSubmit={(value) => handleSaveCareerField('targetRole', value)}
              />
            )}

            {currentStep === 'resume' && (
              <ResumeUploadStep
                resumeText={resumeText}
                onChangeResumeText={setResumeText}
                onChooseNoResume={handleNoResume}
                onSubmit={handleResumeSubmit}
                loading={loading}
                onResumeFile={handleResumeFileUpload}
              />
            )}

            {currentStep === 'interview' && (
              <ResumeInterviewStep
                answers={interviewAnswers}
                onChangeAnswer={handleChangeInterviewAnswer}
                onSubmit={handleInterviewSubmit}
                loading={loading}
              />
            )}

            {currentStep === 'readinessScore' && scoreData && (
              <ReadinessScoreStep
                score={scoreData.score}
                levelLabel={scoreData.levelLabel}
                summary={scoreData.summary}
                recommendations={scoreData.recommendations}
              />
            )}
          </main>
        </div>
      </Content>
    </Layout>
  );
}

