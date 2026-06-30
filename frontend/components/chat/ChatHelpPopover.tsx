'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Button, Popover } from 'antd';
import { useHumeTheme } from '@/lib/useHumeTheme';
import {
  CHAT_OVERLAY_MAX_WIDTH,
  chatHelpPlacement,
  chatOverlayAutoAdjust,
  getChatPopupContainer,
} from '@/lib/chatOverlay';
import { useCloseOnScroll } from '@/lib/useCloseOnScroll';

type ChatHelpPopoverProps = {
  content: ReactNode;
  ariaLabel: string;
  className?: string;
};

export function ChatHelpPopover({ content, ariaLabel, className = '' }: ChatHelpPopoverProps) {
  const isHume = useHumeTheme();
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  useCloseOnScroll(open, handleClose);

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement={chatHelpPlacement}
      autoAdjustOverflow={chatOverlayAutoAdjust}
      destroyOnHidden
      arrow={{ pointAtCenter: true }}
      getPopupContainer={getChatPopupContainer}
      overlayClassName={
        isHume ? 'leo-chat-help-popover leo-chat-help-popover--hume' : 'leo-chat-help-popover'
      }
      styles={{
        root: { maxWidth: CHAT_OVERLAY_MAX_WIDTH, width: 'max-content' },
      }}
      content={<div className="text-xs leading-relaxed">{content}</div>}
    >
      <Button
        type="text"
        size="small"
        icon={<QuestionCircleOutlined />}
        className={
          isHume
            ? `!h-5 !w-5 !min-w-0 !p-0 !text-[var(--color-smoke)] hover:!text-[var(--color-ink)] ${className}`.trim()
            : `!h-5 !w-5 !min-w-0 !p-0 !text-slate-400 hover:!text-slate-200 ${className}`.trim()
        }
        aria-label={ariaLabel}
      />
    </Popover>
  );
}
