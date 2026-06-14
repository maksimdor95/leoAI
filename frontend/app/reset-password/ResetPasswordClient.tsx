'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Form, Input, Typography, message, Spin } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { userAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;

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

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAuthModal } = useAuth();
  const token = searchParams.get('token')?.trim() ?? '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await userAPI.validateResetToken(token);
        if (!cancelled) {
          setTokenValid(result.valid);
        }
      } catch {
        if (!cancelled) {
          setTokenValid(false);
        }
      } finally {
        if (!cancelled) {
          setValidating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (values: { password: string }) => {
    if (!token) return;
    setLoading(true);
    try {
      await userAPI.resetPassword({ token, password: values.password });
      setDone(true);
      message.success('Пароль обновлён');
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'Не удалось обновить пароль'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050913] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8">
        {validating ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spin size="large" />
            <Text className="text-slate-300">Проверяем ссылку…</Text>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <Title level={3} className="!m-0 !text-white">
              Пароль обновлён
            </Title>
            <Text className="text-slate-300">
              Теперь можно войти в аккаунт с новым паролем.
            </Text>
            <Button
              type="primary"
              block
              size="large"
              className="!h-12 !rounded-xl !border-none !bg-green-500 !font-semibold hover:!bg-green-400"
              onClick={() => {
                openAuthModal('login');
                router.push('/');
              }}
            >
              Войти
            </Button>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-4 text-center">
            <Title level={3} className="!m-0 !text-white">
              Ссылка недействительна
            </Title>
            <Text className="text-slate-300">
              Ссылка для сброса пароля устарела или уже была использована. Запросите новую.
            </Text>
            <Button
              type="primary"
              block
              size="large"
              className="!h-12 !rounded-xl !border-none !bg-green-500 !font-semibold hover:!bg-green-400"
              onClick={() => {
                openAuthModal('login');
                router.push('/');
              }}
            >
              Вернуться ко входу
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <Title level={3} className="!m-0 !text-white">
                Новый пароль
              </Title>
              <Text className="text-slate-300">Задайте новый пароль для входа в LEO</Text>
            </div>

            <Form form={form} layout="vertical" size="large" onFinish={handleSubmit}>
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: 'Введите пароль' },
                  { min: 6, message: 'Минимум 6 символов' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder="Новый пароль"
                  className="!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Повторите пароль' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Пароли не совпадают'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder="Повторите пароль"
                  className="!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50"
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  className="!h-12 !rounded-xl !border-none !bg-green-500 !font-semibold hover:!bg-green-400"
                >
                  Сохранить пароль
                </Button>
              </Form.Item>
            </Form>

            <div className="mt-4 text-center">
              <Link href="/" className="text-sm text-slate-400 hover:text-green-300">
                На главную
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
