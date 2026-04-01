import { Form, Input, InputNumber, Typography, Upload, Button, Space, Card } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

type WelcomeStepProps = {
  onNext: () => void;
};

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <Card
      className="border-white/10 bg-white/[0.04] backdrop-blur"
      bordered
      headStyle={{ borderBottom: '1px solid rgba(148, 163, 184, 0.25)' }}
    >
      <Space direction="vertical" size="large" className="w-full">
        <div>
          <Text className="text-xs uppercase tracking-[0.35em] text-green-300/80">
            AI Career Learning
          </Text>
          <Title level={2} className="!mt-2 !mb-2 !text-white">
            Давайте проанализируем вашу карьеру и AI-навыки
          </Title>
          <Paragraph className="!text-slate-300 !mb-0">
            Ответьте на несколько вопросов, загрузите резюме или создайте его с AI — и получите
            первый <Text strong>AI Readiness Score</Text> с рекомендациями по развитию.
          </Paragraph>
        </div>
        <div>
          <Button
            type="primary"
            size="large"
            onClick={onNext}
            className="rounded-full border-none bg-green-500 px-6 py-2 text-white shadow-lg hover:bg-green-400"
          >
            Начать анализ
          </Button>
        </div>
      </Space>
    </Card>
  );
}

type CareerBasicsFormValues = {
  currentRole: string;
  experienceYears: number;
  targetRole: string;
};

type CareerQuestionStepProps = {
  initialValues?: Partial<CareerBasicsFormValues>;
  field: 'currentRole' | 'experienceYears' | 'targetRole';
  onSubmit: (value: string | number) => Promise<void> | void;
  loading: boolean;
};

export function CareerQuestionStep({
  initialValues,
  field,
  onSubmit,
  loading,
}: CareerQuestionStepProps) {
  const [form] = Form.useForm();

  const handleFinish = async (values: CareerBasicsFormValues) => {
    const value =
      field === 'experienceYears' ? Number(values.experienceYears) : values[field] ?? '';
    await onSubmit(value);
  };

  const fieldConfig =
    field === 'currentRole'
      ? {
          label: 'Текущая роль',
          description:
            'Например: Product Manager, Marketing Lead, Data Analyst, Frontend-разработчик.',
          placeholder: 'Ваша текущая должность',
        }
      : field === 'experienceYears'
        ? {
            label: 'Годы опыта',
            description: 'Сколько лет вы активно работаете по своей основной специальности?',
            placeholder: 'Количество лет опыта',
          }
        : {
            label: 'Целевая роль',
            description:
              'Кем вы хотите стать в контексте AI? Например: AI Product Manager, AI Marketing Lead.',
            placeholder: 'Желаемая роль в ближайшие 1–3 года',
          };

  return (
    <Card className="border-white/10 bg-white/[0.04] backdrop-blur" bordered>
      <Space direction="vertical" size="large" className="w-full">
        <div>
          <Text className="text-xs uppercase tracking-[0.35em] text-green-300/80">
            Шаг онбординга
          </Text>
          <Title level={3} className="!mt-2 !mb-2 !text-white">
            {fieldConfig.label}
          </Title>
          <Paragraph className="!text-slate-300 !mb-0">{fieldConfig.description}</Paragraph>
        </div>
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleFinish}
          requiredMark={false}
        >
          {field === 'experienceYears' ? (
            <Form.Item
              name="experienceYears"
              label="Годы опыта"
              rules={[
                { required: true, message: 'Укажите ваш опыт работы' },
                { type: 'number', min: 0, max: 50, message: 'Введите число от 0 до 50' },
              ]}
            >
              <InputNumber
                placeholder={fieldConfig.placeholder}
                min={0}
                max={50}
                style={{ width: '100%' }}
              />
            </Form.Item>
          ) : field === 'currentRole' ? (
            <Form.Item
              name="currentRole"
              label="Текущая должность"
              rules={[{ required: true, message: 'Введите вашу текущую роль' }]}
            >
              <Input placeholder={fieldConfig.placeholder} />
            </Form.Item>
          ) : (
            <Form.Item
              name="targetRole"
              label="Целевая роль"
              rules={[{ required: true, message: 'Введите целевую роль' }]}
            >
              <Input placeholder={fieldConfig.placeholder} />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="rounded-full border-none bg-green-500 px-6 py-2 text-white shadow-lg hover:bg-green-400"
            >
              Далее
            </Button>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );
}

type ResumeUploadStepProps = {
  resumeText: string;
  onChangeResumeText: (value: string) => void;
  onChooseNoResume: () => void;
  onSubmit: () => Promise<void> | void;
  loading: boolean;
};

export function ResumeUploadStep({
  resumeText,
  onChangeResumeText,
  onChooseNoResume,
  onSubmit,
  loading,
}: ResumeUploadStepProps) {
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    disabled: true,
    showUploadList: false,
  };

  return (
    <Card className="border-white/10 bg-white/[0.04] backdrop-blur" bordered>
      <Space direction="vertical" size="large" className="w-full">
        <div>
          <Text className="text-xs uppercase tracking-[0.35em] text-green-300/80">
            Резюме
          </Text>
          <Title level={3} className="!mt-2 !mb-2 !text-white">
            Загрузите резюме или создайте его с AI
          </Title>
          <Paragraph className="!text-slate-300">
            На следующем шаге AI проведет с вами короткое интервью и поможет восстановить резюме,
            если у вас его нет под рукой.
          </Paragraph>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Paragraph className="!text-slate-200 !mb-2">Загрузка файла (скоро)</Paragraph>
            <Dragger
              {...uploadProps}
              className="!bg-transparent !border-dashed !border-white/20 !text-slate-300"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined className="text-3xl text-green-400" />
              </p>
              <p className="ant-upload-text text-slate-100">
                Перетащите файл резюме сюда или нажмите, чтобы выбрать
              </p>
              <p className="ant-upload-hint text-slate-400">
                Поддержка PDF/DOCX появится позже; сейчас можно просто вставить текст резюме ниже.
              </p>
            </Dragger>
          </div>

          <div>
            <Paragraph className="!text-slate-200 !mb-2">Текст резюме</Paragraph>
            <Input.TextArea
              rows={10}
              value={resumeText}
              onChange={(e) => onChangeResumeText(e.target.value)}
              placeholder="Вставьте сюда текст вашего резюме. AI использует его для анализа навыков и опыта."
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Button type="link" onClick={onChooseNoResume} className="!px-0 !text-slate-200">
            У меня нет резюме — создать с AI
          </Button>
          <Button
            type="primary"
            onClick={onSubmit}
            loading={loading}
            className="rounded-full border-none bg-green-500 px-6 py-2 text-white shadow-lg hover:bg-green-400"
          >
            Далее
          </Button>
        </div>
      </Space>
    </Card>
  );
}

type ResumeInterviewStepProps = {
  answers: Record<string, string>;
  onChangeAnswer: (questionId: string, value: string) => void;
  onSubmit: () => Promise<void> | void;
  loading: boolean;
};

const interviewQuestions: { id: string; label: string; placeholder: string }[] = [
  {
    id: 'experience_summary',
    label: 'Кратко опишите ваш опыт',
    placeholder: 'Где вы работали, чем занимались, какие были ключевые задачи?',
  },
  {
    id: 'key_achievements',
    label: '3–5 ключевых достижений',
    placeholder: 'Например: вывели продукт на рынок, увеличили выручку, оптимизировали процесс...',
  },
  {
    id: 'skills',
    label: 'Основные навыки и стек',
    placeholder: 'Инструменты, технологии, методы, которыми вы реально пользуетесь.',
  },
  {
    id: 'ai_experience',
    label: 'Как вы уже используете AI в работе?',
    placeholder:
      'Например: ChatGPT для ресерча, Midjourney для визуалов, Notion AI для заметок, автоматизации и т.п.',
  },
];

export function ResumeInterviewStep({
  answers,
  onChangeAnswer,
  onSubmit,
  loading,
}: ResumeInterviewStepProps) {
  return (
    <Card className="border-white/10 bg-white/[0.04] backdrop-blur" bordered>
      <Space direction="vertical" size="large" className="w-full">
        <div>
          <Text className="text-xs uppercase tracking-[0.35em] text-green-300/80">
            AI Resume Interview
          </Text>
          <Title level={3} className="!mt-2 !mb-2 !text-white">
            Короткое интервью вместо резюме
          </Title>
          <Paragraph className="!text-slate-300">
            Ответьте на несколько вопросов — на их основе мы позже сможем собрать структуру резюме и
            профиль для AI-анализа.
          </Paragraph>
        </div>

        <Space direction="vertical" size="middle" className="w-full">
          {interviewQuestions.map((q) => (
            <div key={q.id}>
              <Text className="block text-sm font-medium text-slate-100 mb-1">{q.label}</Text>
              <Input.TextArea
                rows={4}
                value={answers[q.id] ?? ''}
                onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                placeholder={q.placeholder}
              />
            </div>
          ))}
        </Space>

        <div className="flex justify-end">
          <Button
            type="primary"
            onClick={onSubmit}
            loading={loading}
            className="rounded-full border-none bg-green-500 px-6 py-2 text-white shadow-lg hover:bg-green-400"
          >
            Перейти к AI Readiness Score
          </Button>
        </div>
      </Space>
    </Card>
  );
}

type ReadinessScoreStepProps = {
  score: number;
  levelLabel: string;
  summary: string;
  recommendations: string[];
};

export function ReadinessScoreStep({
  score,
  levelLabel,
  summary,
  recommendations,
}: ReadinessScoreStepProps) {
  const percentage = Math.max(0, Math.min(100, score));

  return (
    <Card className="border-white/10 bg-white/[0.04] backdrop-blur" bordered>
      <Space direction="vertical" size="large" className="w-full">
        <div>
          <Text className="text-xs uppercase tracking-[0.35em] text-green-300/80">
            AI Readiness Score
          </Text>
          <Title level={2} className="!mt-3 !mb-1 !text-white">
            {percentage} / 100
          </Title>
          <Text className="text-sm text-green-300/90 font-semibold uppercase tracking-wide">
            {levelLabel}
          </Text>
        </div>

        <Paragraph className="!text-slate-300">{summary}</Paragraph>

        <div>
          <Text className="block text-sm font-semibold text-slate-100 mb-2">
            Рекомендации на ближайшие шаги:
          </Text>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            {recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>

        <Paragraph className="!text-slate-400 text-sm !mb-0">
          Этот скор пока основан на mock-логике. В следующих итерациях он будет рассчитываться на
          основе вашего резюме, интервью и skills graph.
        </Paragraph>
      </Space>
    </Card>
  );
}

