'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Layout, Modal, message as antdMessage } from 'antd';
import { ChatAppHeaderNav } from '@/components/chat/ChatAppHeaderNav';
import { SupportWidget } from '@/components/support/SupportWidget';
import { AppSettingsForm } from '@/components/settings/AppSettingsForm';
import { DocumentLangSync } from '@/components/landing/DocumentLangSync';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { userAPI } from '@/lib/api';
import { clearClientAuthState, isAuthenticated } from '@/lib/auth';
import { chatUi } from '@/lib/chatUiCopy';
import { useHumeTheme } from '@/lib/useHumeTheme';

const { Content } = Layout;

export function AppSettingsPage() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const isHume = useHumeTheme();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const [messageApi, contextHolder] = antdMessage.useMessage();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

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

  const cardClass = isHume
    ? 'hume-card rounded-2xl p-6 sm:p-8'
    : 'rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur';
  const hintClass = isHume ? 'hume-body-sm !m-0' : 'text-sm text-slate-400 leading-relaxed';

  return (
    <Layout
      className={`leo-settings-page min-h-screen ${
        isHume ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'bg-[#050913] text-white'
      }`}
    >
      {contextHolder}
      <DocumentLangSync />
      <Content className="px-4 py-8 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[var(--page-max-width)]">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link href={authenticated ? '/chat' : '/'}>
                  <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    className={
                      isHume
                        ? 'leo-chats-back !text-[var(--color-smoke)] hover:!text-[var(--color-ink)] hover:!bg-[rgba(34,34,34,0.04)]'
                        : '!text-slate-400 hover:!text-white hover:!bg-white/[0.06]'
                    }
                    aria-label={authenticated ? ui('chatTitle') : ui('chatsBackHome')}
                  />
                </Link>
                <h1
                  className={
                    isHume ? 'hume-heading !text-[var(--text-heading)]' : 'text-2xl font-bold text-white m-0'
                  }
                >
                  {ui('settings')}
                </h1>
              </div>
              <p className={hintClass}>{ui('settingsSubtitle')}</p>
            </div>
            <ChatAppHeaderNav
              onLogout={authenticated ? handleLogout : undefined}
              showMyChats={authenticated}
              showLogout={authenticated}
            />
          </header>

          <section className={cardClass}>
            <AppSettingsForm languageHint={ui('languageHint')} />
          </section>
        </div>
      </Content>
      <SupportWidget />
    </Layout>
  );
}
