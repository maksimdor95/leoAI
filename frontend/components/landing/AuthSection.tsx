'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, Button, Typography, message } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { userAPI } from '@/lib/api';
import { saveToken } from '@/lib/auth';

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

export function AuthSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Check if register mode is requested from URL hash or query parameter
  useEffect(() => {
    // Check query parameter first
    const registerParam = searchParams.get('register');
    if (registerParam === 'true') {
      setMode('register');
      return;
    }

    // Check hash fragment (e.g., #auth?register=true)
    const hash = window.location.hash;
    if (hash.includes('register=true')) {
      setMode('register');
      // Clean up hash
      window.history.replaceState(null, '', window.location.pathname + '#auth');
    }
  }, [searchParams]);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await userAPI.login(values);
      if (result.token) {
        saveToken(result.token);
      }
      message.success('Вход выполнен успешно!');
      router.push('/chat');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Ошибка входа');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }) => {
    setLoading(true);
    try {
      const result = await userAPI.register(values);
      if (result.token) {
        saveToken(result.token);
      }
      message.success('Регистрация успешна!');
      router.push('/chat');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Ошибка регистрации');
      message.error(errorMessage);
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
            {mode === 'login' ? 'Войдите в свой аккаунт' : 'Начни свой путь к идеальной работе'}
          </Title>
          <p className="text-slate-300 text-lg">
            {mode === 'login'
              ? 'Войдите, чтобы продолжить работу с Jack'
              : 'Зарегистрируйся и начни диалог с Jack уже сегодня'}
          </p>
        </div>

        <div className="max-w-md mx-auto animate-fadeIn" style={{ animationDelay: '0.2s' }}>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-8">
            {/* Tabs - показываем только если режим регистрации */}
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
                  Вход
                </button>
                <button className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all bg-green-500 text-white">
                  Регистрация
                </button>
              </div>
            )}

            {/* Form */}
            <Form
              form={form}
              onFinish={mode === 'login' ? handleLogin : handleRegister}
              layout="vertical"
              size="large"
              key={mode} // Reset form when mode changes
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Введите email' },
                  { type: 'email', message: 'Введите корректный email' },
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
                rules={[
                  { required: true, message: 'Введите пароль' },
                  ...(mode === 'register'
                    ? [{ min: 6, message: 'Пароль должен быть не менее 6 символов' }]
                    : []),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder={mode === 'login' ? 'Ваш пароль' : 'Минимум 6 символов'}
                  className="!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50"
                />
              </Form.Item>

              {mode === 'register' && (
                <>
                  <Form.Item name="first_name">
                    <Input
                      prefix={<UserOutlined className="text-slate-400" />}
                      placeholder="Ваше имя (необязательно)"
                      className="!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50"
                    />
                  </Form.Item>
                  <Form.Item name="last_name">
                    <Input
                      prefix={<UserOutlined className="text-slate-400" />}
                      placeholder="Ваша фамилия (необязательно)"
                      className="!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50"
                    />
                  </Form.Item>
                </>
              )}

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  className="h-12 bg-green-500 border-none hover:bg-green-400 text-white font-semibold rounded-xl"
                >
                  {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>
      </div>
    </section>
  );
}
