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
import { toSecondPersonMarketFit } from '@/lib/marketFitCopy';
import { fetchDefaultCareerEnriched } from '@/lib/careerProfileApi';
import type { EnrichedProfileView } from '@/lib/enrichedProfileDisplay';
import { hasCareerSnapshotData } from '@/lib/enrichedProfileDisplay';
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
  const [careerEnriched, setCareerEnriched] = useState<EnrichedProfileView | null>(null);
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
      const [data, enriched] = await Promise.all([
        userAPI.getProfile() as Promise<UserProfileSummary>,
        fetchDefaultCareerEnriched(),
      ]);
      setProfile(data);
      setCareerEnriched(enriched);
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
            <div className="space-y-6">
              <section className={cardClass}>
                <div className="space-y-6">
                  {(profile?.first_name || profile?.last_name) && (
                    <div className="space-y-1">
                      <p className={labelClass}>{settings.locale === 'en' ? 'Name' : 'Имя'}</p>
                      <p className={`${valueClass} font-medium`}>
                        {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ')}
                      </p>
                    </div>
                  )}
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

              {hasCareerSnapshotData(careerEnriched) ? (
                <section className={cardClass}>
                  <h2 className={isHume ? 'hume-heading-sm !mb-4' : 'mb-4 text-lg font-semibold text-white'}>
                    {settings.locale === 'en' ? 'Career snapshot' : 'Карьера'}
                  </h2>
                  {careerEnriched?.isFallback ? (
                    <p className={`${hintClass} mb-4`}>
                      {settings.locale === 'en'
                        ? 'Based on your saved profile. Open LEO chat to refresh the full career snapshot.'
                        : 'Снимок из сохранённого профиля. В чате с LEO обновится полный карьерный анализ.'}
                    </p>
                  ) : null}
                  <div className="space-y-4">
                    {careerEnriched.job_preferences?.target_role ? (
                      <div>
                        <p className={labelClass}>
                          {settings.locale === 'en' ? 'Target role' : 'Целевая роль'}
                        </p>
                        <p className={valueClass}>{careerEnriched.job_preferences.target_role}</p>
                      </div>
                    ) : null}
                    {careerEnriched.role_family ? (
                      <div>
                        <p className={labelClass}>
                          {settings.locale === 'en' ? 'Direction' : 'Направление'}
                        </p>
                        <p className={valueClass}>{careerEnriched.role_family}</p>
                      </div>
                    ) : null}
                    {careerEnriched.seniority ? (
                      <div>
                        <p className={labelClass}>
                          {settings.locale === 'en' ? 'Level' : 'Уровень'}
                        </p>
                        <p className={valueClass}>{careerEnriched.seniority}</p>
                      </div>
                    ) : null}
                    {typeof careerEnriched.profile_completeness === 'number' ? (
                      <div>
                        <p className={labelClass}>
                          {settings.locale === 'en' ? 'Profile completeness' : 'Полнота профиля'}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <div
                            className={`h-2 flex-1 overflow-hidden rounded-full ${
                              isHume ? 'bg-[var(--color-border-hairline)]' : 'bg-white/10'
                            }`}
                          >
                            <div
                              className={
                                isHume
                                  ? 'h-full rounded-full bg-[var(--color-iris)] transition-all'
                                  : 'h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all'
                              }
                              style={{
                                width: `${Math.round(careerEnriched.profile_completeness * 100)}%`,
                              }}
                            />
                          </div>
                          <p className={`${valueClass} shrink-0 tabular-nums`}>
                            {Math.round(careerEnriched.profile_completeness * 100)}%
                          </p>
                        </div>
                        {careerEnriched.missing_fields?.length ? (
                          <p className={`${hintClass} mt-2`}>
                            {settings.locale === 'en' ? 'Missing: ' : 'Не хватает: '}
                            {careerEnriched.missing_fields.slice(0, 3).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {careerEnriched.job_preferences?.red_flags?.length ? (
                      <div>
                        <p className={labelClass}>
                          {settings.locale === 'en' ? 'Exclusions' : 'Исключения'}
                        </p>
                        <p className={`${valueClass} text-sm`}>
                          {careerEnriched.job_preferences.red_flags.join('; ')}
                        </p>
                      </div>
                    ) : null}
                    {careerEnriched.normalized_skills?.length ? (
                      <div>
                        <p className={labelClass}>
                          {settings.locale === 'en' ? 'Skills' : 'Навыки'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {careerEnriched.normalized_skills.slice(0, 12).map((skill) => (
                            <span
                              key={skill.name}
                              className={
                                isHume
                                  ? 'rounded-full border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-2.5 py-0.5 text-xs text-[var(--color-ink)]'
                                  : 'rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-xs text-slate-200'
                              }
                            >
                              {skill.level ? `${skill.name} · ${skill.level}` : skill.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {careerEnriched.market_fit_summary ? (
                      <div>
                        <p className={labelClass}>
                          {settings.locale === 'en' ? 'Market overview' : 'Обзор рынка'}
                        </p>
                        <p className={`${valueClass} text-sm leading-relaxed`}>
                          {toSecondPersonMarketFit(careerEnriched.market_fit_summary)}
                        </p>
                      </div>
                    ) : null}
                    {careerEnriched.achievements_with_metrics?.length ? (
                      <div>
                        <p className={labelClass}>
                          {settings.locale === 'en' ? 'Key achievements' : 'Ключевые достижения'}
                        </p>
                        <ul className="mt-2 space-y-2">
                          {careerEnriched.achievements_with_metrics.slice(0, 5).map((item, index) => (
                            <li
                              key={`${item.achievement}-${index}`}
                              className={
                                isHume
                                  ? 'rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)]'
                                  : 'rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100'
                              }
                            >
                              <p className="leading-relaxed">{item.achievement}</p>
                              {item.metric_before && item.metric_after ? (
                                <p className={`${hintClass} mt-1 text-xs`}>
                                  {item.metric_before} → {item.metric_after}
                                  {item.company ? ` · ${item.company}` : ''}
                                </p>
                              ) : item.company ? (
                                <p className={`${hintClass} mt-1 text-xs`}>{item.company}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <Link href="/chat">
                      <Button type="link" className="!px-0">
                        {settings.locale === 'en' ? 'Continue in LEO chat' : 'Продолжить в чате с LEO'}
                      </Button>
                    </Link>
                  </div>
                </section>
              ) : (
                <section className={cardClass}>
                  <p className={hintClass}>
                    {settings.locale === 'en'
                      ? 'Complete your profile in LEO chat to see career insights here.'
                      : 'Пройдите профиль в чате с LEO — здесь появится карьерный снимок.'}
                  </p>
                  <Link href="/chat" className="inline-block mt-3">
                    <Button type="primary">
                      {settings.locale === 'en' ? 'Open chat' : 'Открыть чат'}
                    </Button>
                  </Link>
                </section>
              )}
            </div>
          )}
        </div>
      </Content>
      <SupportWidget />
    </Layout>
  );
}
