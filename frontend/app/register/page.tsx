'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { userAPI } from '@/lib/api';
import { saveToken } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';
import { parseAuthError, passwordRegisterRules, toAntFieldErrors } from '@/lib/authErrors';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { authUi } from '@/lib/authUiCopy';
import { SocialAuthButton } from '@/components/auth/SocialAuthButton';

const { Title } = Typography;

export default function RegisterPage() {
  const router = useRouter();
  const { openAuthModal } = useAuth();
  const { settings } = useAppSettings();
  const t = authUi(settings.locale);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const startYandexOAuth = () => {
    const url = userAPI.getOAuthStartUrl('yandex');
    window.location.href = url;
  };

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await userAPI.register(values);

      if (result.token) {
        saveToken(result.token);
        captureEvent('user_registered', { method: 'email' });
      }

      message.success(t.registerSuccess);
      router.push('/chat');
    } catch (error: unknown) {
      const parsed = parseAuthError(error, settings.locale, t.registerError);
      message.error(parsed.toastMessage);
      const antFields = toAntFieldErrors(parsed.fieldErrors).filter(
        (f) => f.name === 'email' || f.name === 'password'
      );
      if (antFields.length) form.setFields(antFields);
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
          {t.registerTitle}
        </Title>

        <Form form={form} name="register" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: t.emailRequired },
              { type: 'email', message: t.emailInvalid },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="your@email.com" />
          </Form.Item>

          <Form.Item name="password" label={settings.locale === 'ru' ? 'Пароль' : 'Password'} rules={passwordRegisterRules(settings.locale)}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t.passwordRegisterPlaceholder}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {t.submitRegister}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 10, marginBottom: 6, textAlign: 'center', color: '#8f8fa3' }}>
          {t.orContinue}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SocialAuthButton text={t.yandexLogin} onClick={startYandexOAuth} />
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {settings.locale === 'ru' ? 'Уже есть аккаунт?' : 'Already have an account?'}{' '}
          <Button
            type="link"
            onClick={() => {
              openAuthModal('login');
              router.push('/');
            }}
            style={{ padding: 0, height: 'auto' }}
          >
            {t.submitLogin}
          </Button>
        </div>
      </Card>
    </div>
  );
}
