'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { userAPI } from '@/lib/api';
import { saveToken } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { SocialAuthButton } from '@/components/auth/SocialAuthButton';

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

export default function RegisterPage() {
  const router = useRouter();
  const { openAuthModal } = useAuth();
  const [loading, setLoading] = useState(false);

  const startOAuth = (provider: 'google' | 'yandex') => {
    const url = userAPI.getOAuthStartUrl(provider);
    window.location.href = url;
  };

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await userAPI.register(values);

      // Save token
      if (result.token) {
        saveToken(result.token);
        captureEvent('user_registered', { method: 'email' });
      }

      message.success('Регистрация успешна!');

      // Redirect to chat page
      router.push('/chat');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Ошибка регистрации');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 20,
      }}
    >
      <Card style={{ width: 450 }}>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 30 }}>
          Регистрация
        </Title>

        <Form name="register" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Введите корректный email' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="your@email.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[
              { required: true, message: 'Введите пароль' },
              { min: 6, message: 'Пароль должен быть не менее 6 символов' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Минимум 6 символов" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Зарегистрироваться
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 10, marginBottom: 6, textAlign: 'center', color: '#8f8fa3' }}>
          или продолжить через
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SocialAuthButton
            provider="google"
            text="Войти через Google"
            onClick={() => startOAuth('google')}
          />
          <SocialAuthButton
            provider="yandex"
            text="Войти через Яндекс ID"
            onClick={() => startOAuth('yandex')}
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          Уже есть аккаунт?{' '}
          <Button
            type="link"
            onClick={() => {
              openAuthModal('login');
              router.push('/');
            }}
            style={{ padding: 0, height: 'auto' }}
          >
            Войти
          </Button>
        </div>
      </Card>
    </div>
  );
}
