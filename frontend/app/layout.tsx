import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ConfigProvider } from 'antd';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { GlobalAuthModal } from '@/components/GlobalAuthModal';
import { PostHogProvider } from '@/components/PostHogProvider';
import {
  APP_LOCALE_COOKIE,
  APP_THEME_COOKIE,
  appSettingsFromCookies,
  dataThemeFromCookie,
  localeFromCookie,
} from '@/lib/appThemeCookie';
import { normalizeTtsVoice } from '@/lib/ttsVoices';
import { DEFAULT_APP_SETTINGS } from '@/types/appSettings';
import { THEME_INIT_SCRIPT } from '@/lib/themeInitScript';
import './globals.css';
import '../styles/theme-hume.css';

/** Fellix substitute — weight 500 ≈ design weight 520 */
const humeSans = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  variable: '--font-fellix',
  display: 'swap',
});

/** PP Fraktion Mono substitute */
const humeMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400'],
  variable: '--font-pp-fraktion-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LEO AI - Your Career Assistant',
  description: 'AI assistant for job seekers',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const themeCookie = cookieStore.get(APP_THEME_COOKIE)?.value;
  const localeCookie = cookieStore.get(APP_LOCALE_COOKIE)?.value;
  const dataTheme = dataThemeFromCookie(themeCookie);
  const lang = localeFromCookie(localeCookie);
  const cookieSettings = appSettingsFromCookies(themeCookie, localeCookie);
  const initialAppSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...cookieSettings,
    ttsVoice: normalizeTtsVoice(cookieSettings.ttsLang, DEFAULT_APP_SETTINGS.ttsVoice),
  };

  return (
    <html
      lang={lang}
      data-theme={dataTheme}
      suppressHydrationWarning
      className={`${humeSans.variable} ${humeMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <ConfigProvider>
          <PostHogProvider>
            <AppSettingsProvider initialSettings={initialAppSettings}>
              <AuthProvider>
                {children}
                <GlobalAuthModal />
              </AuthProvider>
            </AppSettingsProvider>
          </PostHogProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
