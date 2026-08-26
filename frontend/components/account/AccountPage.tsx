'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CameraOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Input, Layout, Modal, Spin, message as antdMessage } from 'antd';
import { ChatAppHeaderNav } from '@/components/chat/ChatAppHeaderNav';
import { SupportWidget } from '@/components/support/SupportWidget';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { userAPI } from '@/lib/api';
import { clearClientAuthState, isAuthenticated, type UserProfileSummary } from '@/lib/auth';
import { chatUi } from '@/lib/chatUiCopy';
import { toSecondPersonMarketFit } from '@/lib/marketFitCopy';
import {
  fetchCareerAccountSnapshot,
  setDefaultCareerTrack,
  trackDisplayLabel,
  type CareerTrackSummary,
} from '@/lib/careerProfileApi';
import type { EnrichedProfileView } from '@/lib/enrichedProfileDisplay';
import { hasCareerSnapshotData } from '@/lib/enrichedProfileDisplay';
import { getPublicApiBaseUrl } from '@/lib/publicApiBaseUrl';
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

function initialsFromProfile(profile: UserProfileSummary | null): string {
  const first = profile?.first_name?.trim()?.[0];
  const last = profile?.last_name?.trim()?.[0];
  if (first || last) {
    return `${first ?? ''}${last ?? ''}`.toUpperCase();
  }
  const email = profile?.email?.trim()?.[0];
  return email ? email.toUpperCase() : '?';
}

function displayName(profile: UserProfileSummary | null, locale: 'ru' | 'en'): string {
  const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  return locale === 'en' ? 'Your name' : 'Ваше имя';
}

function resolveAvatarSrc(avatarUrl?: string): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) return avatarUrl;
  const base = getPublicApiBaseUrl().replace(/\/$/, '');
  return `${base}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`;
}

export function AccountPage() {
  const router = useRouter();
  const { openAuthModal } = useAuth();
  const { settings } = useAppSettings();
  const isHume = useHumeTheme();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfileSummary | null>(null);
  const [careerTracks, setCareerTracks] = useState<CareerTrackSummary[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [careerEnriched, setCareerEnriched] = useState<EnrichedProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [switchingTrack, setSwitchingTrack] = useState(false);
  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftLastName, setDraftLastName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
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

  const loadProfile = async (preferredTrackId?: string | null) => {
    try {
      setLoading(true);
      const [data, career] = await Promise.all([
        userAPI.getProfile() as Promise<UserProfileSummary>,
        fetchCareerAccountSnapshot(preferredTrackId),
      ]);
      setProfile(data);
      setDraftFirstName(data.first_name ?? '');
      setDraftLastName(data.last_name ?? '');
      setDraftEmail(data.email ?? '');
      setCareerTracks(career.tracks);
      setSelectedTrackId(career.selectedTrack?.id ?? null);
      setCareerEnriched(career.enriched);
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

  const startEditIdentity = () => {
    setDraftFirstName(profile?.first_name ?? '');
    setDraftLastName(profile?.last_name ?? '');
    setDraftEmail(profile?.email ?? '');
    setEditingIdentity(true);
  };

  const cancelEditIdentity = () => {
    setDraftFirstName(profile?.first_name ?? '');
    setDraftLastName(profile?.last_name ?? '');
    setDraftEmail(profile?.email ?? '');
    setEditingIdentity(false);
  };

  const saveIdentity = async () => {
    try {
      setSavingIdentity(true);
      const payload = {
        first_name: draftFirstName.trim() || undefined,
        last_name: draftLastName.trim() || undefined,
        email: draftEmail.trim() || undefined,
      };
      const res = (await userAPI.updateProfile(payload)) as {
        user?: UserProfileSummary;
      };
      const next = res.user ?? {
        ...profile,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
      };
      setProfile({
        ...profile,
        ...next,
        avatar_url: next.avatar_url ?? profile?.avatar_url,
        created_at: next.created_at ?? profile?.created_at,
      });
      setEditingIdentity(false);
      messageApi.success(ui('accountSaveSuccess'));
    } catch (error) {
      const msg =
        axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : ui('accountSaveError');
      messageApi.error(msg);
    } finally {
      setSavingIdentity(false);
    }
  };

  const mergeProfileUser = (next: UserProfileSummary) => {
    setProfile({
      ...profile,
      ...next,
      created_at: next.created_at ?? profile?.created_at,
    });
  };

  const onAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      messageApi.error(ui('accountAvatarError'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      messageApi.error(ui('accountAvatarHint'));
      return;
    }
    try {
      setUploadingAvatar(true);
      const res = await userAPI.uploadAvatar(file);
      mergeProfileUser(res.user);
      messageApi.success(ui('accountAvatarSuccess'));
    } catch (error) {
      const msg =
        (axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : null) ||
        (error instanceof Error && error.message ? error.message : null) ||
        ui('accountAvatarError');
      messageApi.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    try {
      setUploadingAvatar(true);
      const res = await userAPI.deleteAvatar();
      mergeProfileUser({ ...res.user, avatar_url: undefined });
      messageApi.success(ui('accountAvatarRemoveSuccess'));
    } catch (error) {
      const msg =
        (axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : null) ||
        (error instanceof Error && error.message ? error.message : null) ||
        ui('accountAvatarError');
      messageApi.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const selectTrack = async (trackId: string) => {
    if (trackId === selectedTrackId || switchingTrack) return;
    try {
      setSwitchingTrack(true);
      const updated = await setDefaultCareerTrack(trackId);
      if (!updated) {
        messageApi.error(ui('accountCareerSelectError'));
        return;
      }
      const career = await fetchCareerAccountSnapshot(trackId);
      setCareerTracks(career.tracks);
      setSelectedTrackId(career.selectedTrack?.id ?? trackId);
      setCareerEnriched(career.enriched);
    } catch {
      messageApi.error(ui('accountCareerSelectError'));
    } finally {
      setSwitchingTrack(false);
    }
  };

  const memberSince = profile ? formatMemberSince(settings.locale, profile.created_at) : null;
  const avatarInitials = initialsFromProfile(profile);
  const nameLabel = displayName(profile, settings.locale);
  const avatarSrc = resolveAvatarSrc(profile?.avatar_url);

  const cardClass = isHume
    ? 'hume-card rounded-2xl p-6 sm:p-8'
    : 'rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur';
  const labelClass = isHume ? 'hume-body-sm !m-0' : 'text-xs uppercase tracking-[0.2em] text-slate-500';
  const valueClass = isHume ? 'hume-body !m-0 text-base' : 'text-base text-white';
  const hintClass = isHume ? 'hume-body-sm !m-0' : 'text-sm text-slate-400 leading-relaxed';
  const inputClass = isHume
    ? undefined
    : 'bg-white/[0.06] border-white/15 text-white placeholder:text-slate-500';

  const trackChipClass = (active: boolean) =>
    isHume
      ? `rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
          active
            ? 'border-[var(--color-iris)] bg-[var(--color-iris)]/15 text-[var(--color-ink)]'
            : 'border-[var(--color-border-hairline)] bg-[var(--color-paper)] text-[var(--color-smoke)] hover:border-[var(--color-iris)]/50'
        }`
      : `rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
          active
            ? 'border-emerald-400/60 bg-emerald-500/15 text-white'
            : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:text-white'
        }`;

  return (
    <Layout
      className={`leo-account-page min-h-screen ${
        isHume
          ? 'bg-[var(--color-bone)] text-[var(--color-ink)]'
          : 'leo-account-page--dark bg-[#050913] text-white'
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
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4 sm:gap-5">
                    <div className="group relative shrink-0">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => void onAvatarFileChange(e)}
                      />
                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                        aria-label={ui('accountAvatarChange')}
                        title={ui('accountAvatarHint')}
                        className={
                          isHume
                            ? 'relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-iris)]/15 text-xl font-semibold text-[var(--color-iris)] transition hover:ring-2 hover:ring-[var(--color-iris)]/40 disabled:opacity-60 sm:h-20 sm:w-20 sm:text-2xl'
                            : 'relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#0b1220] text-xl font-semibold text-emerald-300 ring-1 ring-emerald-400/20 transition hover:ring-emerald-400/50 disabled:opacity-60 sm:h-20 sm:w-20 sm:text-2xl'
                        }
                      >
                        {avatarSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarSrc}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : avatarInitials === '?' ? (
                          <UserOutlined />
                        ) : (
                          avatarInitials
                        )}
                        <span
                          className={
                            isHume
                              ? 'absolute inset-0 z-[1] flex items-center justify-center bg-[rgba(34,34,34,0.5)] text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100'
                              : 'absolute inset-0 z-[1] flex items-center justify-center bg-black/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100'
                          }
                        >
                          {uploadingAvatar ? <Spin size="small" /> : <CameraOutlined className="text-lg" />}
                        </span>
                      </button>
                      {profile?.avatar_url ? (
                        <button
                          type="button"
                          disabled={uploadingAvatar}
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeAvatar();
                          }}
                          aria-label={ui('accountAvatarRemove')}
                          title={ui('accountAvatarRemove')}
                          className={
                            isHume
                              ? 'absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-hairline)] bg-[var(--color-paper)] text-[var(--color-smoke)] opacity-0 shadow-sm transition hover:text-red-600 group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-40'
                              : 'absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#0b1220] text-slate-300 opacity-0 shadow-lg transition hover:border-red-400/40 hover:text-red-300 group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-40'
                          }
                        >
                          <DeleteOutlined className="text-xs" />
                        </button>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1 space-y-4">
                      {editingIdentity ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <p className={labelClass}>{ui('accountFirstName')}</p>
                            <Input
                              value={draftFirstName}
                              onChange={(e) => setDraftFirstName(e.target.value)}
                              className={inputClass}
                              autoFocus
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className={labelClass}>{ui('accountLastName')}</p>
                            <Input
                              value={draftLastName}
                              onChange={(e) => setDraftLastName(e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <p className={labelClass}>{ui('accountEmail')}</p>
                            <Input
                              type="email"
                              value={draftEmail}
                              onChange={(e) => setDraftEmail(e.target.value)}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <p className={labelClass}>{ui('accountName')}</p>
                            <h2
                              className={
                                isHume
                                  ? 'hume-heading-sm !m-0 break-words'
                                  : 'm-0 break-words text-xl font-semibold text-white sm:text-2xl'
                              }
                            >
                              {nameLabel}
                            </h2>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <MailOutlined
                                aria-hidden
                                className={isHume ? 'text-[var(--color-iris)]' : 'text-emerald-400'}
                              />
                              <span className={`${valueClass} break-all`}>{profile?.email ?? '—'}</span>
                            </div>
                            {memberSince ? (
                              <div className="flex items-center gap-2">
                                <CalendarOutlined
                                  aria-hidden
                                  className={isHume ? 'text-[var(--color-iris)]' : 'text-emerald-400'}
                                />
                                <span className={hintClass}>
                                  {ui('accountMemberSince')}: {memberSince}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2 self-stretch sm:self-start">
                    {editingIdentity ? (
                      <>
                        <Button
                          type="primary"
                          icon={<CheckOutlined />}
                          loading={savingIdentity}
                          onClick={() => void saveIdentity()}
                        >
                          {ui('save')}
                        </Button>
                        <Button
                          icon={<CloseOutlined />}
                          disabled={savingIdentity}
                          onClick={cancelEditIdentity}
                        >
                          {ui('cancel')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type={isHume ? 'default' : 'default'}
                        icon={<EditOutlined />}
                        onClick={startEditIdentity}
                        className={
                          isHume
                            ? undefined
                            : '!border-white/15 !bg-white/[0.04] !text-white hover:!border-emerald-400/40 hover:!text-emerald-300'
                        }
                      >
                        {ui('accountEdit')}
                      </Button>
                    )}
                  </div>
                </div>
              </section>

              {careerTracks.length > 0 || hasCareerSnapshotData(careerEnriched) ? (
                <section className={cardClass}>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className={isHume ? 'hume-heading-sm !mb-1' : 'mb-1 text-lg font-semibold text-white'}>
                        {settings.locale === 'en' ? 'Career snapshot' : 'Карьера'}
                      </h2>
                      {careerTracks.length > 1 ? (
                        <p className={`${hintClass} max-w-xl`}>{ui('accountCareerTracksHint')}</p>
                      ) : null}
                    </div>
                  </div>

                  {careerTracks.length > 1 ? (
                    <div className="mb-5 space-y-2">
                      <p className={labelClass}>{ui('accountCareerTracks')}</p>
                      <div className="flex flex-wrap gap-2" role="tablist" aria-label={ui('accountCareerTracks')}>
                        {careerTracks.map((track) => {
                          const active = track.id === selectedTrackId;
                          return (
                            <button
                              key={track.id}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              disabled={switchingTrack}
                              className={trackChipClass(active)}
                              onClick={() => void selectTrack(track.id)}
                            >
                              {trackDisplayLabel(track)}
                              {track.is_default && !active ? (
                                <span className="ml-1.5 opacity-50">·</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {careerEnriched?.isFallback ? (
                    <p className={`${hintClass} mb-4`}>
                      {settings.locale === 'en'
                        ? 'Based on your saved profile. Open LEO chat to refresh the full career snapshot.'
                        : 'Снимок из сохранённого профиля. В чате с LEO обновится полный карьерный анализ.'}
                    </p>
                  ) : null}

                  {hasCareerSnapshotData(careerEnriched) && careerEnriched ? (
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
                  ) : (
                    <div>
                      <p className={hintClass}>
                        {settings.locale === 'en'
                          ? 'This direction has no career snapshot yet. Continue the matching chat to fill it.'
                          : 'У этого направления пока нет снимка. Продолжите чат с этой ролью — данные появятся здесь.'}
                      </p>
                      <Link href="/chat" className="inline-block mt-3">
                        <Button type="primary">
                          {settings.locale === 'en' ? 'Open chat' : 'Открыть чат'}
                        </Button>
                      </Link>
                    </div>
                  )}
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
