'use client';

import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthModal } from './AuthModal';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, [pathname]);

  if (pathname !== '/') {
    return null;
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#050913]/80 backdrop-blur-md border-b border-white/10">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-bold text-white hover:text-green-500 transition-colors"
          >
            LEO AI
          </Link>

          <div className="flex items-center gap-6">
            {authenticated ? (
              <Link
                href="/chat"
                className="px-4 py-2 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors"
              >
                Чат с LEO
              </Link>
            ) : (
              <>
                <a href="#features" className="text-slate-300 hover:text-white transition-colors">
                  Возможности
                </a>
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Войти
                </button>
                <button
                  onClick={() => {
                    setAuthMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="px-4 py-2 bg-green-500 text-white font-semibold rounded-full hover:bg-green-400 transition-colors"
                >
                  Начать
                </button>
              </>
            )}
          </div>
        </nav>
      </header>
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </>
  );
}
