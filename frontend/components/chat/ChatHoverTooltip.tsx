'use client';

import type { ReactNode } from 'react';
import { Tooltip, type TooltipProps } from 'antd';
import { useHumeTheme } from '@/lib/useHumeTheme';
import {
  CHAT_OVERLAY_MAX_WIDTH,
  chatOverlayAutoAdjust,
  getChatPopupContainer,
} from '@/lib/chatOverlay';

type ChatHoverTooltipProps = {
  title: ReactNode;
  children: ReactNode;
  placement?: TooltipProps['placement'];
};

export function ChatHoverTooltip({
  title,
  children,
  placement = 'bottom',
}: ChatHoverTooltipProps) {
  const isHume = useHumeTheme();

  return (
    <Tooltip
      title={title}
      placement={placement}
      autoAdjustOverflow={chatOverlayAutoAdjust}
      destroyOnHidden
      arrow={{ pointAtCenter: true }}
      getPopupContainer={getChatPopupContainer}
      styles={{
        root: { maxWidth: CHAT_OVERLAY_MAX_WIDTH },
      }}
      classNames={{
        root: isHume ? 'leo-chat-tooltip leo-chat-tooltip--hume' : 'leo-chat-tooltip',
      }}
    >
      {children}
    </Tooltip>
  );
}
