import { Card, Typography } from 'antd';
import { InfoCardMessage } from '@/types/chat';

const { Title, Paragraph } = Typography;

type InfoPanelProps = {
  infoCard?: InfoCardMessage;
};

export function InfoPanel({ infoCard }: InfoPanelProps) {
  if (!infoCard) {
    return (
      <Card bordered={false} className="shadow-sm">
        <Title level={5}>Подсказки появятся здесь</Title>
        <Paragraph type="secondary">
          LEO будет подсвечивать полезные карточки по мере разговора (компании, следующая тема,
          рекомендации).
        </Paragraph>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card bordered={false} className="shadow-sm bg-blue-50 border border-blue-100">
        <Title level={5} style={{ marginBottom: 8 }}>
          {infoCard.title}
        </Title>
        {infoCard.description && <Paragraph>{infoCard.description}</Paragraph>}
      </Card>

      {infoCard.cards.map((card) => (
        <Card key={card.title} bordered={false} className="shadow-sm">
          <Title level={5} style={{ marginBottom: 6 }}>
            {card.icon && <span className="mr-2">{card.icon}</span>}
            {card.title}
          </Title>
          <Paragraph style={{ marginBottom: 0 }}>{card.content}</Paragraph>
        </Card>
      ))}
    </div>
  );
}
