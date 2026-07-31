'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from 'antd';
import { ChatHoverTooltip } from '@/components/chat/ChatHoverTooltip';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { chatUi } from '@/lib/chatUiCopy';

type ChatAppHeaderNavProps = {
  onLogout?: () => void;
  showMyChats?: boolean;
  showLogout?: boolean;
};

export function ChatAppHeaderNav({
  onLogout,
  showMyChats = true,
  showLogout = true,
}: ChatAppHeaderNavProps) {
  const pathname = usePathname();
  const { settings } = useAppSettings();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const isHume = settings.theme === 'hume-light';
  const btnClass = isHume
    ? 'leo-chat-header-btn !text-[var(--color-ink)] hover:!bg-[rgba(34,34,34,0.04)] text-xs sm:text-sm'
    : 'leo-chat-header-btn !text-slate-200 hover:!bg-white/[0.06] text-xs sm:text-sm';
  const activeBtnClass = isHume
    ? 'leo-chat-header-btn !text-[var(--color-ink)] !border !border-[rgba(34,34,34,0.16)] !bg-[var(--color-paper)] text-xs sm:text-sm'
    : 'leo-chat-header-btn !text-white !border !border-white/20 !bg-white/[0.08] text-xs sm:text-sm';
  const logoutClass = isHume
    ? 'leo-chat-header-btn !text-[var(--color-ink)] hover:!text-red-600 text-xs sm:text-sm'
    : 'leo-chat-header-btn !text-slate-200 hover:!text-red-400 text-xs sm:text-sm';

  const navClass = (href: string) => (pathname === href ? activeBtnClass : btnClass);

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link href="/settings">
        <Button type="text" size="small" className={navClass('/settings')}>
          {ui('settings')}
        </Button>
      </Link>
      <Link href="/account">
        <Button type="text" size="small" className={navClass('/account')}>
          {ui('account')}
        </Button>
      </Link>
      {showMyChats ? (
        <Link href="/chats">
          <Button type="text" size="small" className={navClass('/chats')}>
            <span className="hidden sm:inline">{ui('myChats')}</span>
            <span className="sm:hidden">{ui('myChatsShort')}</span>
          </Button>
        </Link>
      ) : null}
      {showLogout && onLogout ? (
        <ChatHoverTooltip title={ui('logoutTip')}>
          <Button type="text" size="small" onClick={onLogout} className={logoutClass}>
            {ui('logout')}
          </Button>
        </ChatHoverTooltip>
      ) : null}
    </div>
  );
}
