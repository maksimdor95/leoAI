'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Form, Input, Button, Typography, message } from 'antd';
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

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export function AuthModal({ open, onClose, initialMode = 'login' }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Reset mode when modal opens
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      form.resetFields();
    }
  }, [open, initialMode, form]);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await userAPI.login(values);
      if (result.token) {
        saveToken(result.token);
      }
      message.success('Вход выполнен успешно!');
      onClose();
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
      onClose();
      router.push('/chat');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Ошибка регистрации');
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      className="auth-modal"
      styles={{
        content: {
          backgroundColor: '#050913',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        header: {
          backgroundColor: '#050913',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
    >
      <div className="py-4">
        <div className="text-center mb-6">
          <Title level={3} className="text-white text-2xl mb-2">
            {mode === 'login' ? 'Войдите в свой аккаунт' : 'Начни свой путь к идеальной работе'}
          </Title>
          <p className="text-slate-300 text-sm">
            {mode === 'login'
              ? 'Войдите, чтобы продолжить работу с LEO'
              : 'Зарегистрируйся и начни диалог с LEO уже сегодня'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 p-1 bg-white/[0.05] rounded-2xl">
          <button
            onClick={() => {
              setMode('login');
              form.resetFields();
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              mode === 'login'
                ? 'bg-green-500 text-white'
                : 'text-white/80 hover:text-white bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            Вход
          </button>
          <button
            onClick={() => {
              setMode('register');
              form.resetFields();
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
              mode === 'register'
                ? 'bg-green-500 text-white'
                : 'text-white/80 hover:text-white bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            Регистрация
          </button>
        </div>

        {/* Form */}
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
    </Modal>
  );
}
