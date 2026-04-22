'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card, Empty, Layout, Spin, Typography, message as antdMessage, Modal } from 'antd';
import {
  PlusOutlined,
  MessageOutlined,
  CalendarOutlined,
  DeleteOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { conversationAPI, ConversationPreview } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import Link from 'next/link';
import {
  CareerOnboardingProgress,
  onboardingStepTitles,
  readCareerOnboardingProgress,
} from '@/lib/careerOnboardingProgress';

const { Title, Text } = Typography;
const { Content } = Layout;

export default function ChatsPage() {
  const router = useRouter();
  const { openAuthModal } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [onboardingProgress, setOnboardingProgress] = useState<CareerOnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = antdMessage.useMessage();

  useEffect(() => {
    if (!isAuthenticated()) {
      messageApi.warning('Авторизуйтесь, чтобы просмотреть свои чаты.');
      openAuthModal('login');
      router.push('/');
      return;
    }

    loadConversations();
    setOnboardingProgress(readCareerOnboardingProgress());
  }, [router, messageApi]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await conversationAPI.getConversations();
      setConversations(data.conversations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Не удалось загрузить чаты';
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string, conversationTitle: string) => {
    Modal.confirm({
      title: 'Удалить чат?',
      content: `Вы уверены, что хотите удалить чат "${conversationTitle}"? Это действие нельзя отменить.`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okType: 'danger',
      onOk: async () => {
        try {
          await conversationAPI.deleteConversation(conversationId);
          messageApi.success('Чат успешно удален');
          // Reload conversations
          await loadConversations();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Не удалось удалить чат';
          messageApi.error(errorMessage);
        }
      },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getJobTitle = (collectedData: Record<string, unknown>): string => {
    if (collectedData.desiredRole) {
      return String(collectedData.desiredRole);
    }
    return 'Новый диалог';
  };

  return (
    <Layout className="min-h-screen bg-[#050913] text-white">
      {contextHolder}
      <Content className="px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Title level={2} style={{ color: 'white', marginBottom: 0 }}>
                Мои чаты
              </Title>
              <Text type="secondary" style={{ color: 'rgba(148, 163, 184, 0.8)' }}>
                Выберите чат для продолжения или создайте новый
              </Text>
            </div>
            <Link href="/chat?new=true">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="large"
                className="h-12 rounded-full border-none bg-gradient-to-r from-green-500 to-purple-500 px-6 text-base font-semibold text-white shadow-xl hover:from-green-400 hover:to-purple-400"
              >
                Новый чат
              </Button>
            </Link>
          </header>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spin size="large" />
            </div>
          ) : conversations.length === 0 && !onboardingProgress ? (
            <Card className="border-white/10 bg-white/[0.04] backdrop-blur">
              <Empty
                description={
                  <span className="text-slate-300">
                    У вас пока нет чатов. Создайте новый, чтобы начать диалог.
                  </span>
                }
              >
                <div className="mt-4">
                  <Link href="/chat?new=true">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      size="large"
                      className="rounded-full border-none bg-gradient-to-r from-green-500 to-purple-500 px-8 text-base font-semibold text-white shadow-xl hover:from-green-400 hover:to-purple-400"
                    >
                      Начать новый чат
                    </Button>
                  </Link>
                </div>
              </Empty>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {onboardingProgress && (
                <Link href="/career/onboarding">
                  <Card
                    hoverable
                    className="h-full border-white/10 bg-white/[0.04] backdrop-blur transition-all hover:bg-white/[0.08] hover:shadow-lg"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300">
                              onboarding
                            </span>
                          </div>
                          <Title level={4} style={{ color: 'white', marginBottom: 8, fontSize: 18 }}>
                            AI Career Onboarding
                          </Title>
                          <Text
                            type="secondary"
                            className="line-clamp-2 text-sm"
                            style={{ color: 'rgba(148, 163, 184, 0.8)' }}
                          >
                            {onboardingProgress.completed
                              ? 'Завершено. Можно открыть результаты AI Readiness.'
                              : `Текущий шаг: ${onboardingStepTitles[onboardingProgress.step]}`}
                          </Text>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <RocketOutlined />
                          <span>{onboardingProgress.completed ? 'Завершено' : 'В процессе'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarOutlined />
                          <span>{formatDate(onboardingProgress.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              )}
              {conversations.map((conversation) => (
                <div key={conversation.id} className="relative group">
                  <Link href={`/chat?sessionId=${conversation.id}`}>
                    <Card
                      hoverable
                      className="h-full border-white/10 bg-white/[0.04] backdrop-blur transition-all hover:bg-white/[0.08] hover:shadow-lg"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  conversation.product === 'wannanew'
                                    ? 'bg-purple-500/30 text-purple-300'
                                    : 'bg-green-500/30 text-green-300'
                                }`}
                              >
                                {conversation.product === 'wannanew' ? 'Leo' : 'LEO'}
                              </span>
                            </div>
                            <Title
                              level={4}
                              style={{ color: 'white', marginBottom: 8, fontSize: 18 }}
                            >
                              {getJobTitle(conversation.collectedData)}
                            </Title>
                            <Text
                              type="secondary"
                              className="line-clamp-2 text-sm"
                              style={{ color: 'rgba(148, 163, 184, 0.8)' }}
                            >
                              {conversation.preview}
                            </Text>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <MessageOutlined />
                            <span>{conversation.messageCount} сообщений</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CalendarOutlined />
                            <span>{formatDate(conversation.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    size="small"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/20 hover:bg-red-500/40 border-red-500/50 text-red-400 hover:text-red-300"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteConversation(
                        conversation.id,
                        getJobTitle(conversation.collectedData)
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Content>
    </Layout>
  );
}
