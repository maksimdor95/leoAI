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
    ? 'leo-chat-header-btn !border-0 !bg-transparent !shadow-none !text-[var(--color-ink)]/65 hover:!bg-transparent hover:!text-[var(--color-ink)] text-xs sm:text-sm'
    : 'leo-chat-header-btn !border-0 !bg-transparent !shadow-none !text-slate-400 hover:!bg-transparent hover:!text-slate-100 text-xs sm:text-sm';
  const activeBtnClass = isHume
    ? 'leo-chat-header-btn !border-0 !bg-transparent !shadow-none !font-semibold !text-[var(--color-ink)] underline decoration-[var(--color-iris)] decoration-2 underline-offset-[6px] hover:!bg-transparent text-xs sm:text-sm'
    : 'leo-chat-header-btn !border-0 !bg-transparent !shadow-none !font-medium !text-white underline decoration-white/70 decoration-2 underline-offset-[6px] hover:!bg-transparent text-xs sm:text-sm';
  const logoutClass = isHume
    ? 'leo-chat-header-btn !border-0 !bg-transparent !shadow-none !text-[var(--color-ink)]/65 hover:!bg-transparent hover:!text-red-600 text-xs sm:text-sm'
    : 'leo-chat-header-btn !border-0 !bg-transparent !shadow-none !text-slate-400 hover:!bg-transparent hover:!text-red-400 text-xs sm:text-sm';

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
