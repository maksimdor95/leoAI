import type { TooltipPlacement } from 'antd/es/tooltip';

export const CHAT_OVERLAY_MAX_WIDTH = 'min(280px, calc(100vw - 2rem))';

export const chatOverlayAutoAdjust = {
  adjustX: 1,
  adjustY: 1,
} as const;

export const chatHelpPlacement: TooltipPlacement = 'bottom';

export function getChatPopupContainer(): HTMLElement {
  return document.body;
}
