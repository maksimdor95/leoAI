'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Form, Input, Button, Typography, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { userAPI } from '@/lib/api';
import { syncAnalyticsIdentity } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';
import { resolvePostAuthHref } from '@/lib/pendingAuthRedirect';
import { SocialAuthButton } from '@/components/auth/SocialAuthButton';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { authUi } from '@/lib/authUiCopy';
import { useHumeTheme } from '@/lib/useHumeTheme';
import type { AuthModalSource } from '@/contexts/AuthContext';

type ApiError = {
  response?: {
    data?: {
      error?: string;
    };
  };
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const apiError = error as ApiError;
    const messageText = apiError.response?.data?.error;
    if (typeof messageText === 'string' && messageText.trim().length > 0) {
      return messageText;
    }
  }
  return fallback;
};

const { Title } = Typography;

const FIELD_CLASS_LEO =
  '!border-0 !bg-transparent !shadow-none !text-white !placeholder:text-slate-500';

const FIELD_CLASS_HUME =
  '!border-0 !bg-transparent !shadow-none !text-[var(--color-ink)] !placeholder:text-[var(--color-smoke)]';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  source?: AuthModalSource;
}

export function AuthModal({
  open,
  onClose,
  initialMode = 'login',
  source = 'unknown',
}: AuthModalProps) {
  const router = useRouter();
  const { settings } = useAppSettings();
  const isHume = useHumeTheme();
  const t = authUi(settings.locale);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'forgot-sent'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [forgotEmail, setForgotEmail] = useState('');

  const fieldClass = isHume ? FIELD_CLASS_HUME : FIELD_CLASS_LEO;

  const startYandexOAuth = () => {
    const url = userAPI.getOAuthStartUrl('yandex');
    window.location.href = url;
  };

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setForgotEmail('');
      form.resetFields();
    }
  }, [open, initialMode, form]);

  const handleForgotPassword = async (values: { email: string }) => {
    setLoading(true);
    try {
      const result = await userAPI.forgotPassword(values.email);
      setForgotEmail(values.email);
      setMode('forgot-sent');
      message.success(result.message);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, t.forgotError));
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    captureEvent('auth_modal_closed', { mode, source, completed: false });
    onClose();
  };

  const finishAuth = async (eventName: 'user_logged_in' | 'user_registered', method: string) => {
    await syncAnalyticsIdentity();
    captureEvent(eventName, { method, source });
    message.success(eventName === 'user_logged_in' ? t.loginSuccess : t.registerSuccess);
    onClose();
    router.push(resolvePostAuthHref());
  };

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await userAPI.login(values);
      await finishAuth('user_logged_in', 'email');
    } catch (error: unknown) {
      captureEvent('auth_failed', { method: 'email', mode: 'login', source });
      message.error(getErrorMessage(error, t.loginError));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await userAPI.register(values);
      await finishAuth('user_registered', 'email');
    } catch (error: unknown) {
      captureEvent('auth_failed', { method: 'email', mode: 'register', source });
      message.error(getErrorMessage(error, t.registerError));
    } finally {
      setLoading(false);
    }
  };

  const titleText =
    mode === 'login'
      ? t.loginTitle
      : mode === 'register'
        ? t.registerTitle
        : mode === 'forgot-sent'
          ? t.forgotSentTitle
          : t.forgotTitle;

  const subtitleText =
    mode === 'login'
      ? t.loginSubtitle
      : mode === 'register'
        ? t.registerSubtitle
        : mode === 'forgot-sent'
          ? t.forgotSentSubtitle(forgotEmail)
          : t.forgotSubtitle;

  const modalStyles = isHume
    ? {
        content: {
          backgroundColor: '#ffffff',
          border: '1px solid rgba(34, 34, 34, 0.08)',
        },
        header: {
          backgroundColor: '#ffffff',
          borderBottom: '1px solid rgba(34, 34, 34, 0.08)',
        },
      }
    : {
        content: {
          backgroundColor: '#050913',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        header: {
          backgroundColor: '#050913',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      };

  const tabWrapClass = isHume
    ? 'flex gap-4 mb-6 p-1 bg-[var(--color-bone)] rounded-2xl'
    : 'flex gap-4 mb-6 p-1 bg-white/[0.05] rounded-2xl';

  const tabActiveClass = isHume
    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
    : 'bg-green-500 text-white';

  const tabIdleClass = isHume
    ? 'text-[var(--color-smoke)] hover:text-[var(--color-ink)] bg-[var(--color-paper)] hover:bg-[var(--color-meringue)]'
    : 'text-white/80 hover:text-white bg-white/[0.03] hover:bg-white/[0.06]';

  const primaryBtnClass = isHume
    ? 'hume-btn-pill !h-12 !w-full !text-base'
    : '!h-12 !rounded-xl !border-none !bg-green-500 !text-white !font-semibold !shadow-lg !shadow-green-500/20 hover:!bg-green-400 hover:!text-white active:!scale-[0.98]';

  const linkBtnClass = isHume
    ? 'auth-text-btn text-sm text-[var(--color-smoke)] transition-colors hover:text-[var(--color-ink)]'
    : 'auth-text-btn text-sm text-slate-400 transition-colors hover:text-green-300';

  return (
    <Modal
      open={open}
      onCancel={handleDismiss}
      footer={null}
      centered
      width={480}
      className={isHume ? 'auth-modal leo-hume-modal' : 'auth-modal'}
      styles={modalStyles}
    >
      <div className="py-4">
        <div className="mb-6 text-center">
          <Title
            level={3}
            className={`mb-2 text-2xl ${isHume ? 'hume-heading !text-xl' : 'text-white'}`}
          >
            {titleText}
          </Title>
          <p className={`text-sm ${isHume ? 'hume-body-sm' : 'text-slate-300'}`}>{subtitleText}</p>
        </div>

        {mode === 'login' || mode === 'register' ? (
          <>
            <div className={tabWrapClass}>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  form.resetFields();
                }}
                className={`auth-tab-btn flex-1 rounded-xl px-4 py-3 font-semibold transition-all ${
                  mode === 'login' ? tabActiveClass : tabIdleClass
                }`}
              >
                {t.tabLogin}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  form.resetFields();
                }}
                className={`auth-tab-btn flex-1 rounded-xl px-4 py-3 font-semibold transition-all ${
                  mode === 'register' ? tabActiveClass : tabIdleClass
                }`}
              >
                {t.tabRegister}
              </button>
            </div>

            <Form
              form={form}
              onFinish={mode === 'login' ? handleLogin : handleRegister}
              layout="vertical"
              size="large"
              key={mode}
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: t.emailRequired },
                  { type: 'email', message: t.emailInvalid },
                ]}
              >
                <Input
                  prefix={
                    <MailOutlined className={isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'} />
                  }
                  placeholder="your@email.com"
                  className={fieldClass}
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: t.passwordRequired },
                  ...(mode === 'register' ? [{ min: 6, message: t.passwordMin }] : []),
                ]}
              >
                <Input.Password
                  prefix={
                    <LockOutlined className={isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'} />
                  }
                  placeholder={
                    mode === 'login' ? t.passwordLoginPlaceholder : t.passwordRegisterPlaceholder
                  }
                  className={fieldClass}
                />
              </Form.Item>

              {mode === 'login' && (
                <div className="-mt-2 mb-4 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      form.resetFields();
                    }}
                    className={`${linkBtnClass} text-xs sm:text-sm`}
                  >
                    {t.forgotLink}
                  </button>
                </div>
              )}

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  className={primaryBtnClass}
                >
                  {mode === 'login' ? t.submitLogin : t.submitRegister}
                </Button>
              </Form.Item>
            </Form>
            <div className="mt-4">
              <p className={`mb-3 text-center text-xs ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'}`}>
                {t.orContinue}
              </p>
              <div className="flex flex-col gap-3">
                <SocialAuthButton text={t.yandexLogin} onClick={startYandexOAuth} hume={isHume} />
              </div>
            </div>
          </>
        ) : mode === 'forgot' ? (
          <Form form={form} onFinish={handleForgotPassword} layout="vertical" size="large">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: t.emailRequired },
                { type: 'email', message: t.emailInvalid },
              ]}
            >
              <Input
                prefix={
                  <MailOutlined className={isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'} />
                }
                placeholder="your@email.com"
                className={fieldClass}
              />
            </Form.Item>
            <Form.Item className="mb-2">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className={primaryBtnClass}
              >
                {t.sendResetLink}
              </Button>
            </Form.Item>
            <div className="text-center">
              <button type="button" onClick={() => setMode('login')} className={linkBtnClass}>
                {t.backToLogin}
              </button>
            </div>
          </Form>
        ) : (
          <div className="space-y-4">
            <Button type="primary" block size="large" className={primaryBtnClass} onClick={() => {
              setMode('login');
              form.resetFields();
            }}>
              {t.backToLoginBtn}
            </Button>
            <div className="text-center">
              <button type="button" onClick={() => setMode('forgot')} className={linkBtnClass}>
                {t.resendLink}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
