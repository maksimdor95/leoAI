'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Empty, Layout, Spin, message as antdMessage, Modal } from 'antd';
import {
  PlusOutlined,
  MessageOutlined,
  CalendarOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { conversationAPI, ConversationPreview } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import Link from 'next/link';
import { SupportWidget } from '@/components/support/SupportWidget';
import { AppSettingsMenu } from '@/components/chat/AppSettingsMenu';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import {
  chatUi,
  chatsDeleteContent,
  formatChatRelativeTime,
} from '@/lib/chatUiCopy';
import { useHumeTheme } from '@/lib/useHumeTheme';

const { Content } = Layout;

function productChipLabel(product: string): string {
  if (product === 'wannanew') return 'Leo';
  if (product === 'interview-prep') return 'Prep';
  return 'LEO';
}

export default function ChatsPage() {
  const router = useRouter();
  const { openAuthModal } = useAuth();
  const { settings } = useAppSettings();
  const isHume = useHumeTheme();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = antdMessage.useMessage();

  useEffect(() => {
    if (!isAuthenticated()) {
      messageApi.warning(ui('chatsAuthRequired'));
      openAuthModal('login', { source: 'chats_auth_required' });
      router.push('/');
      return;
    }

    loadConversations();
  }, [router, messageApi]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await conversationAPI.getConversations();
      setConversations(data.conversations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ui('chatsLoadError');
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string, conversationTitle: string) => {
    Modal.confirm({
      title: ui('chatsDeleteTitle'),
      content: chatsDeleteContent(settings.locale, conversationTitle),
      okText: ui('chatsDeleteOk'),
      cancelText: ui('chatsDeleteCancel'),
      okType: 'danger',
      className: isHume ? 'leo-hume-modal' : undefined,
      onOk: async () => {
        try {
          await conversationAPI.deleteConversation(conversationId);
          messageApi.success(ui('chatsDeleted'));
          await loadConversations();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : ui('chatsDeleteError');
          messageApi.error(errorMessage);
        }
      },
    });
  };

  const formatDate = (dateString: string) => formatChatRelativeTime(settings.locale, dateString);

  const getJobTitle = (collectedData: Record<string, unknown>): string => {
    if (collectedData.desiredRole) {
      return String(collectedData.desiredRole);
    }
    return ui('chatsNewDialog');
  };

  const newChatButtonClass = isHume
    ? 'hume-btn-pill !h-11 !px-6 !text-sm !border-none'
    : 'h-12 rounded-full border-none bg-gradient-to-r from-green-500 to-purple-500 px-6 text-base font-semibold text-white shadow-xl hover:from-green-400 hover:to-purple-400';

  return (
    <Layout
      className={`leo-chats-page min-h-screen ${
        isHume ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'bg-[#050913] text-white'
      }`}
    >
      {contextHolder}
      <Content className="px-4 py-8 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[var(--page-max-width)]">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link href="/">
                  <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    className={
                      isHume
                        ? 'leo-chats-back !text-[var(--color-smoke)] hover:!text-[var(--color-ink)] hover:!bg-[rgba(34,34,34,0.04)]'
                        : '!text-slate-400 hover:!text-white hover:!bg-white/[0.06]'
                    }
                    aria-label={ui('chatsBackHome')}
                  />
                </Link>
                <h1 className={isHume ? 'hume-heading !text-[var(--text-heading)]' : 'text-2xl font-bold text-white m-0'}>
                  {ui('myChats')}
                </h1>
              </div>
              <p className={isHume ? 'hume-body !m-0 max-w-xl' : 'text-slate-400 m-0'}>
                {ui('chatsSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <AppSettingsMenu />
              <Link href="/chat?new=true">
                <Button type="primary" icon={<PlusOutlined />} size="large" className={newChatButtonClass}>
                  {ui('newChat')}
                </Button>
              </Link>
            </div>
          </header>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spin size="large" />
            </div>
          ) : conversations.length === 0 ? (
            <div
              className={
                isHume
                  ? 'hume-card rounded-2xl p-8 sm:p-10 text-center'
                  : 'rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur'
              }
            >
              <Empty
                description={
                  <span className={isHume ? 'hume-body-sm' : 'text-slate-300'}>
                    {ui('chatsEmpty')}
                  </span>
                }
              >
                <div className="mt-4">
                  <Link href="/chat?new=true">
                    <Button type="primary" icon={<PlusOutlined />} size="large" className={newChatButtonClass}>
                      {ui('chatsStartNew')}
                    </Button>
                  </Link>
                </div>
              </Empty>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="group relative">
                  <Link href={`/chat?sessionId=${conversation.id}`} className="block h-full">
                    <article
                      className={
                        isHume
                          ? 'hume-card leo-chat-card h-full p-5 transition-colors hover:bg-[var(--color-bone)]'
                          : 'h-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition-all hover:bg-white/[0.08] hover:shadow-lg'
                      }
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span
                              className={
                                isHume
                                  ? `hume-chip !text-[10px] ${
                                      conversation.product === 'interview-prep'
                                        ? '!bg-[var(--color-meringue)] !border-transparent'
                                        : conversation.product === 'wannanew'
                                          ? '!bg-[var(--color-blush)] !border-transparent'
                                          : '!bg-[var(--color-mint)] !border-transparent'
                                    }`
                                  : `text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                      conversation.product === 'wannanew'
                                        ? 'bg-purple-500/30 text-purple-300'
                                        : 'bg-green-500/30 text-green-300'
                                    }`
                              }
                            >
                              {productChipLabel(conversation.product)}
                            </span>
                            <h2
                              className={
                                isHume
                                  ? 'mt-2 hume-heading !text-base sm:!text-lg line-clamp-2'
                                  : 'mt-2 text-lg font-semibold text-white line-clamp-2'
                              }
                            >
                              {getJobTitle(conversation.collectedData)}
                            </h2>
                            <p
                              className={
                                isHume
                                  ? 'mt-2 hume-body-sm line-clamp-2'
                                  : 'mt-2 line-clamp-2 text-sm text-slate-400'
                              }
                            >
                              {conversation.preview}
                            </p>
                          </div>
                        </div>
                        <div
                          className={
                            isHume
                              ? 'flex items-center gap-4 hume-label-sm !normal-case !tracking-normal !text-[11px] !text-[var(--color-smoke)]'
                              : 'flex items-center gap-4 text-xs text-slate-400'
                          }
                        >
                          <div className="flex items-center gap-1.5">
                            <MessageOutlined aria-hidden />
                            <span>{conversation.messageCount} сообщений</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CalendarOutlined aria-hidden />
                            <span>{formatDate(conversation.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    size="small"
                    aria-label="Удалить чат"
                    className={
                      isHume
                        ? 'absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity !text-[var(--color-smoke)] hover:!text-[var(--color-ink)] hover:!bg-[var(--color-bone)] !rounded-full'
                        : 'absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/20 hover:bg-red-500/40 border-red-500/50 text-red-400 hover:text-red-300'
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteConversation(
                        conversation.id,
                        getJobTitle(conversation.collectedData),
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Content>
      <SupportWidget />
    </Layout>
  );
}
