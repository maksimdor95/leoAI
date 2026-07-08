'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from 'antd';
import { ChatHoverTooltip } from '@/components/chat/ChatHoverTooltip';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { chatUi } from '@/lib/chatUiCopy';

// `AppSettingsMenu` uses client-only UI APIs (portals / DOM) and currently
// crashes during SSR in dev. Loading it with `ssr:false` keeps `/chat` working.
const AppSettingsMenu = dynamic(
  () =>
    import('@/components/chat/AppSettingsMenu').then((mod) => mod.AppSettingsMenu),
  { ssr: false, loading: () => null }
);

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
  const { settings } = useAppSettings();
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const isHume = settings.theme === 'hume-light';
  const btnClass = isHume
    ? 'leo-chat-header-btn !text-[var(--color-ink)] hover:!bg-[rgba(34,34,34,0.04)] text-xs sm:text-sm'
    : 'leo-chat-header-btn !text-slate-200 hover:!bg-white/[0.06] text-xs sm:text-sm';
  const logoutClass = isHume
    ? 'leo-chat-header-btn !text-[var(--color-ink)] hover:!text-red-600 text-xs sm:text-sm'
    : 'leo-chat-header-btn !text-slate-200 hover:!text-red-400 text-xs sm:text-sm';

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <AppSettingsMenu />
      <Link href="/account">
        <Button type="text" size="small" className={btnClass}>
          {ui('account')}
        </Button>
      </Link>
      {showMyChats ? (
        <Link href="/chats">
          <Button type="text" size="small" className={btnClass}>
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
