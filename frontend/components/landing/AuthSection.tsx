'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, Button, Typography, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { userAPI } from '@/lib/api';
import { syncAnalyticsIdentity } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';
import { parseAuthError, passwordRegisterRules, toAntFieldErrors } from '@/lib/authErrors';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { authUi } from '@/lib/authUiCopy';

const { Title } = Typography;

export function AuthSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useAppSettings();
  const t = authUi(settings.locale);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const registerParam = searchParams.get('register');
    if (registerParam === 'true') {
      setMode('register');
      return;
    }

    const hash = window.location.hash;
    if (hash.includes('register=true')) {
      setMode('register');
      window.history.replaceState(null, '', window.location.pathname + '#auth');
    }
  }, [searchParams]);

  const applyAuthError = (error: unknown, fallback: string) => {
    const parsed = parseAuthError(error, settings.locale, fallback);
    message.error(parsed.toastMessage);
    const antFields = toAntFieldErrors(parsed.fieldErrors).filter(
      (f) => f.name === 'email' || f.name === 'password'
    );
    if (antFields.length) form.setFields(antFields);
  };

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await userAPI.login(values);
      void syncAnalyticsIdentity();
      captureEvent('user_logged_in', { method: 'email' });
      message.success(t.loginSuccess);
      router.push('/chat');
    } catch (error: unknown) {
      applyAuthError(error, t.loginError);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await userAPI.register(values);
      void syncAnalyticsIdentity();
      captureEvent('user_registered', { method: 'email' });
      message.success(t.registerSuccess);
      router.push('/chat');
    } catch (error: unknown) {
      applyAuthError(error, t.registerError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-20 bg-[#050913] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 animate-fadeIn">
          <Title level={2} className="text-white text-4xl md:text-5xl mb-4">
            {mode === 'login' ? t.loginTitle : t.registerTitle}
          </Title>
          <p className="text-slate-300 text-lg">
            {mode === 'login' ? t.loginSubtitle : t.registerSubtitle}
          </p>
        </div>

        <div className="max-w-md mx-auto animate-fadeIn" style={{ animationDelay: '0.2s' }}>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-8">
            {mode === 'register' && (
              <div className="flex gap-4 mb-8 p-1 bg-white/[0.05] rounded-2xl">
                <button
                  onClick={() => {
                    setMode('login');
                    form.resetFields();
                    router.replace('/#auth');
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-white/80 hover:text-white bg-white/[0.03] hover:bg-white/[0.06]"
                >
                  {t.tabLogin}
                </button>
                <button className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all bg-green-500 text-white">
                  {t.tabRegister}
                </button>
              </div>
            )}

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
                  prefix={<MailOutlined className="text-slate-400" />}
                  placeholder="your@email.com"
                  className="!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={
                  mode === 'register'
                    ? passwordRegisterRules(settings.locale)
                    : [{ required: true, message: t.passwordRequired }]
                }
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder={
                    mode === 'login' ? t.passwordLoginPlaceholder : t.passwordRegisterPlaceholder
                  }
                  className="!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50"
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  className="h-12 bg-green-500 border-none hover:bg-green-400 text-white font-semibold rounded-xl"
                >
                  {mode === 'login' ? t.submitLogin : t.submitRegister}
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>
      </div>
    </section>
  );
}
