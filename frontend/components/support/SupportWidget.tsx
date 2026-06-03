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
import { getBoostyUrl } from '@/lib/boostyLink';
import { buildTelegramSupportUrl, getTelegramSupportUrl } from '@/lib/supportLink';
import { submitConsultationLead } from '@/lib/consultationApi';
import { captureEvent } from '@/lib/analytics';

const SERVICE_OPTIONS = [
  'Подбор вакансий',
  'Подготовка к собеседованию',
  'Тренажёр интервью',
  'Корпоративное внедрение (B2B)',
  'Другое',
];

const FIELD_CLASS =
  '!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50';

const PRIMARY_BTN_CLASS =
  'inline-flex w-full items-center justify-center rounded-full border-none bg-gradient-to-r from-green-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-500/20 transition-all hover:from-green-400 hover:to-purple-400';

const CONSULTATION_PANEL_CLASS =
  'w-[17.5rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-white/10 bg-[#0a0f1e] p-5 shadow-2xl shadow-black/70 ring-1 ring-white/[0.06]';

const CONSULTATION_MODAL_STYLES = {
  content: {
    backgroundColor: '#0a0f1e',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  header: { backgroundColor: '#0a0f1e', borderBottom: 'none' },
};

const CONSULTATION_SECONDARY_BTN_CLASS =
  'inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-[#121826] px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-green-500/30 hover:bg-[#1a2234]';

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
  /** floating — угол экрана; toolbar — в панели ввода чата (мобилка). */
  placement?: 'floating' | 'toolbar';
};

/** Единый размер плавающей кнопки поддержки (FAB) во всех контекстах. */
const FLOATING_BUTTON_CLASS =
  'flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-green-500 text-white shadow-lg shadow-green-500/25 transition-all hover:scale-105 hover:bg-green-400 active:scale-95';

const boostyUrl = getBoostyUrl();

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.93c-.23.23-.42.42-.83.42z" />
  </svg>
);

const BoostyIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);

export function SupportWidget({
  showTeaser = true,
  placement = 'floating',
}: SupportWidgetProps) {
  const [open, setOpen] = useState(false);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState(() => buildTelegramSupportUrl());
  const [form] = Form.useForm<ConsultationFormValues>();
  const [messageApi, contextHolder] = antdMessage.useMessage();

  useEffect(() => {
    setTelegramUrl(getTelegramSupportUrl());
  }, []);

  const isToolbar = placement === 'toolbar';

  const closeMenu = () => {
    setOpen(false);
    setMenuModalOpen(false);
  };

  const togglePanel = () => {
    if (isToolbar) {
      setMenuModalOpen(true);
      captureEvent('support_widget_opened');
      return;
    }
    setOpen((prev) => {
      const next = !prev;
      if (next) captureEvent('support_widget_opened');
      return next;
    });
  };

  const handleOpenForm = () => {
    captureEvent('support_widget_write_us_clicked');
    closeMenu();
    setFormOpen(true);
  };

  const handleTelegram = () => {
    captureEvent('support_widget_telegram_clicked');
    closeMenu();
  };

  const handleBoosty = () => {
    captureEvent('support_widget_boosty_clicked');
    closeMenu();
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

  const positionClass =
    'bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]';

  const anchorClass =
    'right-[calc(1.25rem+env(safe-area-inset-right,0px))] sm:right-6';

  const renderConsultationActions = () => (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={handleOpenForm} className={PRIMARY_BTN_CLASS}>
        Написать нам →
      </button>
      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleTelegram}
        className={CONSULTATION_SECONDARY_BTN_CLASS}
      >
        <TelegramIcon />
        Telegram
      </a>
      <a
        href={boostyUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleBoosty}
        className={`${CONSULTATION_SECONDARY_BTN_CLASS} text-orange-300 hover:border-orange-500/30 hover:text-orange-200`}
      >
        <BoostyIcon />
        Boosty
      </a>
    </div>
  );

  const renderConsultationPanel = () => (
    <>
      <div className="border-b border-white/10 pb-3">
        <div className="text-base font-semibold text-white">Получить консультацию</div>
        <p className="mt-1.5 text-sm leading-6 text-slate-400">
          Ответим за 2 часа. Без спама и навязчивых звонков.
        </p>
      </div>
      <div className="mt-4">{renderConsultationActions()}</div>
    </>
  );

  const triggerButton = (
    <button
      type="button"
      onClick={togglePanel}
      aria-label="Открыть консультацию"
      aria-expanded={isToolbar ? menuModalOpen : open}
      aria-haspopup="dialog"
      className={
        isToolbar
          ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-200 transition-all hover:bg-white/[0.08] active:scale-95 sm:h-9 sm:w-9'
          : FLOATING_BUTTON_CLASS
      }
    >
      {open && !isToolbar ? (
        <CloseOutlined style={{ fontSize: 22 }} />
      ) : (
        <MessageOutlined style={{ fontSize: isToolbar ? 16 : 22 }} />
      )}
    </button>
  );

  const anchor = (
    <div
      className={
        isToolbar
          ? 'flex shrink-0'
          : 'group pointer-events-auto flex w-14 flex-col items-end gap-3'
      }
    >
      {showTeaser && !open && !isToolbar && (
        <div
          role="tooltip"
          className="pointer-events-none hidden w-[13.5rem] max-w-[calc(100vw-5rem)] translate-y-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left opacity-0 shadow-xl shadow-black/30 backdrop-blur transition-all duration-200 invisible [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:visible"
        >
          <div className="text-sm font-semibold text-white">Есть вопрос?</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
            AI-ассистент онлайн
          </div>
        </div>
      )}

      {open && !isToolbar && (
        <div className={CONSULTATION_PANEL_CLASS}>{renderConsultationPanel()}</div>
      )}

      {triggerButton}
    </div>
  );

  return (
    <>
      {contextHolder}

      {isToolbar ? (
        anchor
      ) : (
        <div
          className={`pointer-events-none fixed ${positionClass} ${anchorClass} z-[1000]`}
        >
          {anchor}
        </div>
      )}

      {isToolbar && (
        <Modal
          open={menuModalOpen}
          onCancel={() => setMenuModalOpen(false)}
          footer={null}
          centered
          width={400}
          destroyOnClose
          title={
            <div>
              <div className="text-base font-semibold text-white">Получить консультацию</div>
              <div className="mt-1 text-sm font-normal text-slate-400">
                Ответим за 2 часа. Без спама и навязчивых звонков.
              </div>
            </div>
          }
          className="consultation-modal"
          styles={CONSULTATION_MODAL_STYLES}
        >
          {renderConsultationActions()}
        </Modal>
      )}

      <Modal
        open={formOpen}
        onCancel={handleCloseForm}
        footer={null}
        centered
        width={460}
        destroyOnClose
        title={
          <div>
            <div className="text-base font-semibold text-white">Написать нам</div>
            <div className="mt-1 text-sm font-normal text-slate-400">
              Оставьте контакты — свяжемся в течение 2 часов.
            </div>
          </div>
        }
        className="consultation-modal"
        styles={CONSULTATION_MODAL_STYLES}
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
