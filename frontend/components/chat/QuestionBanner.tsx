import { Alert, Typography } from 'antd';
import { QuestionMessage } from '@/types/chat';

const { Title, Paragraph } = Typography;

type QuestionBannerProps = {
  question?: QuestionMessage;
};

export function QuestionBanner({ question }: QuestionBannerProps) {
  if (!question) {
    return null;
  }

  return (
    <Alert
      type="info"
      showIcon
      className="mb-4 bg-blue-50 border-blue-200"
      message={
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            {question.question}
          </Title>
          {question.placeholder && (
            <Paragraph style={{ marginBottom: 0 }}>{question.placeholder}</Paragraph>
          )}
        </div>
      }
    />
  );
}
