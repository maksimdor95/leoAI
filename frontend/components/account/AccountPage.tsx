'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ArrowLeftOutlined, CalendarOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Layout, Modal, Spin, message as antdMessage } from 'antd';
import { ChatAppHeaderNav } from '@/components/chat/ChatAppHeaderNav';
import { SupportWidget } from '@/components/support/SupportWidget';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { userAPI } from '@/lib/api';
import { clearClientAuthState, isAuthenticated, type UserProfileSummary } from '@/lib/auth';
import { chatUi } from '@/lib/chatUiCopy';
import { useHumeTheme } from '@/lib/useHumeTheme';

const { Content } = Layout;

function formatMemberSince(locale: 'ru' | 'en', value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function AccountPage() {
  const router = useRouter();
  const { openAuthModal } = useAuth();
  const { settings } = useAppSettings();
  const isHume = useHumeTheme();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const [profile, setProfile] = useState<UserProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = antdMessage.useMessage();

  useEffect(() => {
    if (!isAuthenticated()) {
      messageApi.warning(ui('accountAuthRequired'));
      openAuthModal('login', { source: 'chat_auth_required' });
      router.push('/');
      return;
    }

    void loadProfile();
  }, [router, messageApi]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = (await userAPI.getProfile()) as UserProfileSummary;
      setProfile(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        clearClientAuthState();
        messageApi.warning(ui('accountAuthRequired'));
        openAuthModal('login', { source: 'chat_auth_required' });
        router.push('/');
        return;
      }
      const errorMessage = error instanceof Error ? error.message : ui('accountLoadError');
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: ui('logoutConfirmTitle'),
      content: ui('logoutConfirmContent'),
      okText: ui('logout'),
      cancelText: ui('cancel'),
      className: isHume ? 'leo-hume-modal' : undefined,
      onOk: async () => {
        try {
          await userAPI.logout();
        } catch {
          // Even if backend logout fails, clear local auth state.
        }
        clearClientAuthState();
        messageApi.success(ui('logoutSuccess'));
        router.push('/');
      },
    });
  };

  const memberSince = profile ? formatMemberSince(settings.locale, profile.created_at) : null;

  const cardClass = isHume
    ? 'hume-card rounded-2xl p-6 sm:p-8'
    : 'rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur';
  const labelClass = isHume ? 'hume-body-sm !m-0' : 'text-xs uppercase tracking-[0.2em] text-slate-500';
  const valueClass = isHume ? 'hume-body !m-0 text-base' : 'text-base text-white';
  const hintClass = isHume ? 'hume-body-sm !m-0' : 'text-sm text-slate-400 leading-relaxed';
  return (
    <Layout
      className={`leo-account-page min-h-screen ${
        isHume ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'bg-[#050913] text-white'
      }`}
    >
      {contextHolder}
      <Content className="px-4 py-8 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[var(--page-max-width)]">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link href="/chat">
                  <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    className={
                      isHume
                        ? 'leo-chats-back !text-[var(--color-smoke)] hover:!text-[var(--color-ink)] hover:!bg-[rgba(34,34,34,0.04)]'
                        : '!text-slate-400 hover:!text-white hover:!bg-white/[0.06]'
                    }
                    aria-label={ui('chatTitle')}
                  />
                </Link>
                <h1 className={isHume ? 'hume-heading !text-[var(--text-heading)]' : 'text-2xl font-bold text-white m-0'}>
                  {ui('accountTitle')}
                </h1>
              </div>
              <p className={hintClass}>{ui('accountSubtitle')}</p>
            </div>
            <ChatAppHeaderNav onLogout={handleLogout} showMyChats showLogout />
          </header>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spin size="large" />
            </div>
          ) : (
            <section className={`${cardClass} max-w-xl`}>
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <MailOutlined
                    aria-hidden
                    className={isHume ? 'mt-1 text-[var(--color-iris)]' : 'mt-1 text-green-400'}
                  />
                  <div className="min-w-0 space-y-1">
                    <p className={labelClass}>{ui('accountEmail')}</p>
                    <p className={`${valueClass} break-all font-medium`}>{profile?.email ?? '—'}</p>
                  </div>
                </div>

                {memberSince ? (
                  <div className="flex items-start gap-3">
                    <CalendarOutlined
                      aria-hidden
                      className={isHume ? 'mt-1 text-[var(--color-iris)]' : 'mt-1 text-green-400'}
                    />
                    <div className="space-y-1">
                      <p className={labelClass}>{ui('accountMemberSince')}</p>
                      <p className={valueClass}>{memberSince}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>
      </Content>
      <SupportWidget />
    </Layout>
  );
}
