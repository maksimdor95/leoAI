'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  message as antdMessage,
} from 'antd';
import { CloseOutlined, MessageOutlined } from '@ant-design/icons';
import { buildTelegramSupportUrl, getTelegramSupportUrl } from '@/lib/supportLink';
import { submitConsultationLead } from '@/lib/consultationApi';
import { captureEvent } from '@/lib/analytics';

const SERVICE_OPTIONS = [
  'Подбор вакансий',
  'Подготовка к собеседованию',
  'Тренажёр интервью',
  'AI Career Onboarding',
  'Корпоративное внедрение (B2B)',
  'Другое',
];

const FIELD_CLASS =
  '!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50';

const PRIMARY_BTN_CLASS =
  'inline-flex w-full items-center justify-center rounded-full border-none bg-gradient-to-r from-green-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-500/20 transition-all hover:from-green-400 hover:to-purple-400';

type ConsultationFormValues = {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  message: string;
  consent: boolean;
};

type SupportWidgetProps = {
  /** Плашка «Есть вопрос?» — скрываем там, где наезжает на контент (экран выбора продукта). */
  showTeaser?: boolean;
  /** Поднять выше, когда внизу страницы есть поле ввода чата. */
  elevated?: boolean;
};

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.93c-.23.23-.42.42-.83.42z" />
  </svg>
);

export function SupportWidget({ showTeaser = true, elevated = false }: SupportWidgetProps) {
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState(() => buildTelegramSupportUrl());
  const [form] = Form.useForm<ConsultationFormValues>();
  const [messageApi, contextHolder] = antdMessage.useMessage();

  useEffect(() => {
    setTelegramUrl(getTelegramSupportUrl());
  }, []);

  const togglePanel = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) captureEvent('support_widget_opened');
      return next;
    });
  };

  const handleOpenForm = () => {
    captureEvent('support_widget_write_us_clicked');
    setOpen(false);
    setFormOpen(true);
  };

  const handleTelegram = () => {
    captureEvent('support_widget_telegram_clicked');
    setOpen(false);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    form.resetFields();
  };

  const handleSubmit = async (values: ConsultationFormValues) => {
    setSubmitting(true);
    try {
      await submitConsultationLead({
        name: values.name,
        email: values.email,
        phone: values.phone,
        service: values.service,
        message: values.message,
        consent: values.consent,
      });
      captureEvent('support_widget_lead_submitted', { service: values.service });
      messageApi.success('Заявка отправлена! Ответим в течение 2 часов.');
      handleCloseForm();
    } catch (error) {
      messageApi.error(
        error instanceof Error
          ? error.message
          : 'Не удалось отправить заявку. Напишите нам в Telegram.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const positionClass = elevated
    ? 'bottom-[5.75rem] sm:bottom-[6.25rem]'
    : 'bottom-5 sm:bottom-6';

  return (
    <>
      {contextHolder}

      <div
        className={`pointer-events-none fixed ${positionClass} right-5 z-[1000] sm:right-6`}
      >
        <div className="group pointer-events-auto flex w-[3.5rem] flex-col items-end gap-3">
          {showTeaser && !open && (
            <div
              role="tooltip"
              className="pointer-events-none w-[13.5rem] max-w-[calc(100vw-5rem)] translate-y-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left opacity-0 shadow-xl shadow-black/30 backdrop-blur transition-all duration-200 invisible group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-hover:visible"
            >
              <div className="text-sm font-semibold text-white">Есть вопрос?</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
                AI-ассистент онлайн
              </div>
            </div>
          )}

          {open && (
            <div className="w-[17.5rem] max-w-[calc(100vw-5rem)] rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/40 backdrop-blur">
              <div className="text-base font-semibold text-white">Получить консультацию</div>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">
                Ответим за 2 часа. Без спама и навязчивых звонков.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                <button type="button" onClick={handleOpenForm} className={PRIMARY_BTN_CLASS}>
                  Написать нам →
                </button>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleTelegram}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-green-500/30 hover:bg-white/[0.08]"
                >
                  <TelegramIcon />
                  Telegram
                </a>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={togglePanel}
            aria-label={open ? 'Закрыть консультацию' : 'Открыть консультацию'}
            aria-expanded={open}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-green-500 text-white shadow-lg shadow-green-500/25 transition-all hover:scale-105 hover:bg-green-400 active:scale-95"
          >
            {open ? (
              <CloseOutlined style={{ fontSize: 22 }} />
            ) : (
              <MessageOutlined style={{ fontSize: 22 }} />
            )}
          </button>
        </div>
      </div>

      <Modal
        open={formOpen}
        onCancel={handleCloseForm}
        footer={null}
        centered
        width={460}
        title={
          <div>
            <div className="text-base font-semibold text-white">Написать нам</div>
            <div className="mt-1 text-sm font-normal text-slate-400">
              Оставьте контакты — свяжемся в течение 2 часов.
            </div>
          </div>
        }
        className="consultation-modal"
        styles={{
          content: {
            backgroundColor: '#0a0f1e',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
          header: { backgroundColor: '#0a0f1e', borderBottom: 'none' },
        }}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
          initialValues={{ consent: false }}
          className="mt-2"
        >
          <Form.Item name="name" label={<span className="text-slate-300">Имя</span>}>
            <Input placeholder="Александр" size="large" className={FIELD_CLASS} />
          </Form.Item>
          <Form.Item
            name="email"
            label={<span className="text-slate-300">Email</span>}
            rules={[{ type: 'email', message: 'Введите корректный email' }]}
          >
            <Input placeholder="alex@company.ru" size="large" className={FIELD_CLASS} />
          </Form.Item>
          <Form.Item name="phone" label={<span className="text-slate-300">Телефон</span>}>
            <Input placeholder="+7 (903) 601-42-22" size="large" className={FIELD_CLASS} />
          </Form.Item>
          <Form.Item
            name="service"
            label={<span className="text-slate-300">Интересующая услуга</span>}
          >
            <Select
              size="large"
              placeholder="Выберите услугу"
              options={SERVICE_OPTIONS.map((s) => ({ label: s, value: s }))}
              allowClear
              classNames={{ popup: { root: 'consultation-select-dropdown' } }}
            />
          </Form.Item>
          <Form.Item
            name="message"
            label={<span className="text-slate-300">Расскажите о задаче</span>}
            rules={[{ required: true, message: 'Опишите вашу задачу' }]}
          >
            <Input.TextArea
              placeholder="Опишите вашу задачу, текущие процессы и ожидаемый результат…"
              autoSize={{ minRows: 3, maxRows: 6 }}
              className={FIELD_CLASS}
            />
          </Form.Item>
          <Form.Item
            name="consent"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Необходимо согласие на обработку данных')),
              },
            ]}
          >
            <Checkbox className="text-xs text-slate-400">
              Я соглашаюсь на обработку персональных данных в соответствии с{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300"
                onClick={(e) => e.stopPropagation()}
              >
                политикой конфиденциальности
              </a>
              .
            </Checkbox>
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={submitting}
            block
            className="!h-12 rounded-xl border-none bg-green-500 text-base font-semibold text-white shadow-lg hover:bg-green-400"
          >
            Отправить заявку
          </Button>
        </Form>
      </Modal>
    </>
  );
}
