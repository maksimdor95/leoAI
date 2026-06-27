import { Message, MessageType } from '../../types/message';
import { ConversationSession } from '../../types/session';
import { handleCommand, handleUserReply } from '../dialogueEngine';
import * as aiClient from '../aiClient';

jest.mock('../aiClient');

const mockedAi = aiClient as jest.Mocked<typeof aiClient>;

function makeInterviewPrepSession(
  collectedData: Record<string, unknown> = {}
): ConversationSession {
  return {
    id: 'test-session',
    userId: 'user-1',
    metadata: {
      product: 'interview-prep',
      scenarioId: 'interview-prep-v1',
      currentStepId: 'mode_select',
      status: 'active',
      flags: {},
      collectedData: {
        vacancyProfile: { role: 'Product Owner', level: 'Senior' },
        prepPlan: [{ day: 1, focus: 'B2B', tasks: ['метрики'] }],
        ...collectedData,
      },
      completedSteps: ['vacancy_input'],
    },
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ConversationSession;
}

function textContent(message: Message | null): string {
  if (!message || message.type !== MessageType.TEXT) {
    throw new Error('expected TEXT message');
  }
  return message.content;
}

describe('interviewPrepModeFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAi.generateInterviewModeResponse.mockResolvedValue('AI response');
    mockedAi.gradeInterviewAnswer.mockResolvedValue({
      overallScore: 2,
      dimensionScores: {
        structure: 2,
        depth: 2,
        metrics: 2,
        tradeOffs: 2,
        communication: 2,
        seniorityFit: 2,
      },
      fatalGaps: ['нет метрик', 'нет структуры'],
      strengths: [],
      improvements: ['добавить цифры'],
      followUpToProbe: 'Какие метрики?',
      modelStructure: ['цель', 'метрика', 'результат'],
    });
    mockedAi.generateMockInterviewSummary.mockResolvedValue('Mock summary');
  });

  it('mock: briefing on mode start when gate passed', async () => {
    const session = makeInterviewPrepSession({
      diagnosticsPackComplete: true,
      theoryLessonsCompleted: 2,
      starHistory: [{ grading: { overallScore: 6 } }],
    });
    const result = await handleCommand(session, 'mock', 'interview_mode:mock');

    expect(result.metadataUpdates?.collectedData?.mockPhase).toBe('briefing');
    expect(textContent(result.message)).toContain('безопасная среда');
    expect(mockedAi.generateInterviewModeResponse).not.toHaveBeenCalled();
  });

  it('mock: gate blocks briefing when prerequisites missing', async () => {
    const session = makeInterviewPrepSession();
    const result = await handleCommand(session, 'mock', 'interview_mode:mock');

    expect(result.metadataUpdates?.collectedData?.mockPhase).toBeUndefined();
    expect(textContent(result.message)).toContain('Мок-интервью пока недоступно');
    expect(mockedAi.generateInterviewModeResponse).not.toHaveBeenCalled();
  });

  it('mock: active after готов', async () => {
    const session = makeInterviewPrepSession({
      mockPhase: 'briefing',
      activeMode: 'mock',
      diagnosticsPackComplete: true,
      theoryLessonsCompleted: 2,
      starHistory: [{ grading: { overallScore: 6 } }],
    });
    mockedAi.generateInterviewModeResponse.mockResolvedValueOnce('Вопрос 1?');

    const result = await handleUserReply(session, 'готов');

    expect(result.metadataUpdates?.collectedData?.mockPhase).toBe('active');
    expect(mockedAi.generateInterviewModeResponse).toHaveBeenCalledWith(
      expect.objectContaining({ responsePhase: 'mock_active' })
    );
  });

  it('case: weak answer triggers rescue phase', async () => {
    const session = makeInterviewPrepSession({ activeMode: 'case' });
    const weakAnswer =
      'Ну я бы подумал над этим вопросом и сделал что-то полезное для продукта без конкретики.';

    const result = await handleUserReply(session, weakAnswer);

    expect(mockedAi.gradeInterviewAnswer).toHaveBeenCalled();
    expect(mockedAi.generateInterviewModeResponse).toHaveBeenCalledWith(
      expect.objectContaining({ responsePhase: 'rescue', mode: 'case' })
    );
    const artifacts = result.metadataUpdates?.collectedData?.prepArtifacts ?? [];
    expect(Array.isArray(artifacts)).toBe(true);
    expect((artifacts as unknown[]).length).toBeGreaterThan(0);
  });

  it('theory: starts with theory_learn on mode command', async () => {
    const session = makeInterviewPrepSession();
    mockedAi.generateInterviewModeResponse.mockResolvedValueOnce('Урок без вопроса.');

    const result = await handleCommand(session, 'theory', 'interview_mode:theory');

    expect(result.metadataUpdates?.collectedData?.lesson_phase).toBe('learn');
    expect(mockedAi.generateInterviewModeResponse).toHaveBeenCalledWith(
      expect.objectContaining({ responsePhase: 'theory_learn', mode: 'theory' })
    );
    expect(textContent(result.message)).toContain('Урок');
  });

  it('diagnostics: emits pack after enough answers', async () => {
    const session = makeInterviewPrepSession({
      activeMode: 'diagnostics',
      diagnosticsHistory: [
        { userMessage: 'a1' },
        { userMessage: 'a2' },
        { userMessage: 'a3' },
      ],
    });
    mockedAi.generateInterviewModeResponse.mockResolvedValueOnce('Карта пробелов');

    const result = await handleUserReply(session, 'Четвёртый развёрнутый ответ на диагностику');

    expect(mockedAi.generateInterviewModeResponse).toHaveBeenCalledWith(
      expect.objectContaining({ responsePhase: 'diagnostics_pack' })
    );
    expect(result.metadataUpdates?.collectedData?.diagnosticsPackComplete).toBe(true);
    const artifacts = result.metadataUpdates?.collectedData?.prepArtifacts;
    expect(Array.isArray(artifacts)).toBe(true);
    expect((artifacts as unknown[]).length).toBeGreaterThan(0);
    if (result.message?.type === 'text') {
      expect(result.message.packType).toBe('diagnostics_map');
    }
  });
});
