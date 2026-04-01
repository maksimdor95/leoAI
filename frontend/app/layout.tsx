import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import { AuthProvider } from '@/contexts/AuthContext';
import { GlobalAuthModal } from '@/components/GlobalAuthModal';
import './globals.css';

export const metadata: Metadata = {
  title: 'LEO AI - Your Career Assistant',
  description: 'AI assistant for job seekers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ConfigProvider>
          <AuthProvider>
            {children}
            <GlobalAuthModal />
          </AuthProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
