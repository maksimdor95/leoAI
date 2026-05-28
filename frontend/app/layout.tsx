import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import { AuthProvider } from '@/contexts/AuthContext';
import { GlobalAuthModal } from '@/components/GlobalAuthModal';
import { PostHogProvider } from '@/components/PostHogProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'LEO AI - Your Career Assistant',
  description: 'AI assistant for job seekers',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ConfigProvider>
          <PostHogProvider>
            <AuthProvider>
              {children}
              <GlobalAuthModal />
            </AuthProvider>
          </PostHogProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
