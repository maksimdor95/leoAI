'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { supportServiceOptions, supportUi } from '@/lib/supportUiCopy';

const FIELD_CLASS =
  '!bg-black/30 !border-white/10 !text-white !placeholder:text-slate-500 hover:!border-white/20 focus:!border-green-500/50';

const PRIMARY_BTN_CLASS =
  'support-widget-primary-btn inline-flex w-full items-center justify-center rounded-full border-none bg-gradient-to-r from-green-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-500/20 transition-all hover:from-green-400 hover:to-purple-400';

const CONSULTATION_PANEL_CLASS =
  'support-widget-panel w-[17.5rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-white/10 bg-[#0a0f1e] p-5 shadow-2xl shadow-black/70 ring-1 ring-white/[0.06]';

const CONSULTATION_MODAL_STYLES = {
  content: {
    backgroundColor: '#0a0f1e',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  header: { backgroundColor: '#0a0f1e', borderBottom: 'none' },
};

const CONSULTATION_SECONDARY_BTN_CLASS =
  'support-widget-secondary-btn inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-[#121826] px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-green-500/30 hover:bg-[#1a2234]';

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
  /** floating — FAB в углу; toolbar — компактная кнопка в панели ввода чата. */
  placement?: 'floating' | 'toolbar';
};

/** Единый размер плавающей кнопки поддержки (FAB) во всех контекстах. */
const FLOATING_BUTTON_CLASS =
  'support-widget-fab flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-green-500 text-white shadow-lg shadow-green-500/25 transition-all hover:scale-105 hover:bg-green-400 active:scale-95';

const TOOLBAR_BUTTON_CLASS =
  'support-widget-toolbar-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-200 transition-all hover:bg-white/[0.08] active:scale-95 sm:h-9 sm:w-9';

const PANEL_ANCHOR_CLASS =
  'right-[calc(1.25rem+env(safe-area-inset-right,0px))] sm:right-6';

const TOOLBAR_OVERLAY_Z = 'z-[2500]';

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
  const { settings } = useAppSettings();
  const isHume = settings.theme === 'hume-light';
  const locale = settings.locale;
  const s = (key: Parameters<typeof supportUi>[1]) => supportUi(locale, key);
  const serviceOptions = supportServiceOptions(locale);
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState(() => buildTelegramSupportUrl());
  const [form] = Form.useForm<ConsultationFormValues>();
  const [messageApi, contextHolder] = antdMessage.useMessage();

  const isToolbar = placement === 'toolbar';

  useEffect(() => {
    setTelegramUrl(getTelegramSupportUrl());
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isToolbar || !open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isToolbar, open]);

  const closeMenu = () => {
    setOpen(false);
  };

  const togglePanel = () => {
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
      messageApi.success(s('leadSuccess'));
      handleCloseForm();
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : s('leadError')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const floatingBottomClass =
    'bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]';

  const toolbarPanelBottomClass =
    'bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]';

  const renderConsultationActions = () => (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={handleOpenForm} className={PRIMARY_BTN_CLASS}>
        {s('writeUs')}
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
      <div className={`support-widget-divider border-b border-white/10 pb-3 ${isHume ? '' : ''}`}>
        <div className={`support-widget-title text-base font-semibold ${isHume ? '' : 'text-white'}`}>
          {s('consultationTitle')}
        </div>
        <p className={`support-widget-subtitle mt-1.5 text-sm leading-6 ${isHume ? '' : 'text-slate-400'}`}>
          {s('consultationSubtitle')}
        </p>
      </div>
      <div className="mt-4">{renderConsultationActions()}</div>
    </>
  );

  const consultationPanel = (
    <div
      className={CONSULTATION_PANEL_CLASS}
      role="dialog"
      aria-label={s('consultationTitle')}
    >
      {renderConsultationPanel()}
    </div>
  );

  const toolbarPanelLayer =
    open && isToolbar && mounted
      ? createPortal(
          <div className={`fixed inset-0 ${TOOLBAR_OVERLAY_Z}`}>
            <button
              type="button"
              className={`support-widget-overlay absolute inset-0 ${isHume ? 'bg-[#222]/25 backdrop-blur-[2px]' : 'bg-[#050913]/75 backdrop-blur-[2px]'}`}
              onClick={closeMenu}
              aria-label={s('closeConsultation')}
            />
            <div
              className={`pointer-events-none absolute ${toolbarPanelBottomClass} inset-x-3 sm:inset-x-auto sm:right-6`}
            >
              <div className="pointer-events-auto ml-auto w-full max-w-[17.5rem] sm:w-[17.5rem]">
                {consultationPanel}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const formModal = (
    <Modal
      open={formOpen}
      onCancel={handleCloseForm}
      footer={null}
      centered
      width={460}
      destroyOnHidden
      title={
        <div>
          <div className="text-base font-semibold text-white">{s('writeUsModal')}</div>
          <div className="mt-1 text-sm font-normal text-slate-400">
            {s('writeUsModalHint')}
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
        <Form.Item name="name" label={<span className="text-slate-300">{s('name')}</span>}>
          <Input placeholder={locale === 'en' ? 'Alex' : 'Александр'} size="large" className={FIELD_CLASS} />
        </Form.Item>
        <Form.Item
          name="email"
          label={<span className="text-slate-300">{s('email')}</span>}
          rules={[{ type: 'email', message: s('invalidEmail') }]}
        >
          <Input placeholder="alex@company.ru" size="large" className={FIELD_CLASS} />
        </Form.Item>
        <Form.Item name="phone" label={<span className="text-slate-300">{s('phone')}</span>}>
          <Input placeholder="+7 (903) 601-42-22" size="large" className={FIELD_CLASS} />
        </Form.Item>
        <Form.Item
          name="service"
          label={<span className="text-slate-300">{s('service')}</span>}
        >
          <Select
            size="large"
            placeholder={s('servicePlaceholder')}
            options={serviceOptions.map((option) => ({ label: option, value: option }))}
            allowClear
            classNames={{ popup: { root: 'consultation-select-dropdown' } }}
          />
        </Form.Item>
        <Form.Item
          name="message"
          label={<span className="text-slate-300">{s('message')}</span>}
          rules={[{ required: true, message: s('taskRequired') }]}
        >
          <Input.TextArea
            placeholder={s('messagePlaceholder')}
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
                value ? Promise.resolve() : Promise.reject(new Error(s('consentRequired'))),
            },
          ]}
        >
          <Checkbox className="text-xs text-slate-400">
            {s('consent')}{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300"
              onClick={(e) => e.stopPropagation()}
            >
              {s('privacyPolicy')}
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
          {s('submit')}
        </Button>
      </Form>
    </Modal>
  );

  if (isToolbar) {
    return (
      <>
        {contextHolder}
        {toolbarPanelLayer}
        <button
          type="button"
          onClick={togglePanel}
          aria-label={s('openConsultation')}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <MessageOutlined style={{ fontSize: 16 }} />
        </button>
        {formModal}
      </>
    );
  }

  return (
    <>
      {contextHolder}

      <div
        className={`pointer-events-none fixed ${floatingBottomClass} ${PANEL_ANCHOR_CLASS} z-[1000]`}
      >
        <div className="group pointer-events-auto flex w-14 flex-col items-end gap-3">
          {showTeaser && !open && (
            <div
              role="tooltip"
              className="support-widget-teaser pointer-events-none hidden w-[13.5rem] max-w-[calc(100vw-5rem)] translate-y-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left opacity-0 shadow-xl shadow-black/30 backdrop-blur transition-all duration-200 invisible [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:visible"
            >
              <div className={`support-widget-title text-sm font-semibold ${isHume ? '' : 'text-white'}`}>
                {s('teaserTitle')}
              </div>
              <div className={`support-widget-subtitle mt-0.5 flex items-center gap-1.5 text-xs ${isHume ? '' : 'text-slate-400'}`}>
                <span
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    isHume ? 'bg-[var(--color-iris)]' : 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]'
                  }`}
                />
                {s('teaserOnline')}
              </div>
            </div>
          )}

          {open && consultationPanel}

          <button
            type="button"
            onClick={togglePanel}
            aria-label={s('openConsultation')}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={FLOATING_BUTTON_CLASS}
          >
            {open ? (
              <CloseOutlined style={{ fontSize: 22 }} />
            ) : (
              <MessageOutlined style={{ fontSize: 22 }} />
            )}
          </button>
        </div>
      </div>

      {formModal}
    </>
  );
}
