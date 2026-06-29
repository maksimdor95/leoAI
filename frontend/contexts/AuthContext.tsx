'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { captureEvent } from '@/lib/analytics';

export type AuthModalSource =
  | 'hero_cta'
  | 'preview_start'
  | 'footer_register'
  | 'hash_link'
  | 'chat_auth_required'
  | 'chats_auth_required'
  | 'register_page'
  | 'reset_password'
  | 'unknown';

export type OpenAuthModalOptions = {
  source?: AuthModalSource;
};

interface AuthContextType {
  isAuthModalOpen: boolean;
  authMode: 'login' | 'register';
  authModalSource: AuthModalSource;
  openAuthModal: (mode?: 'login' | 'register', options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authModalSource, setAuthModalSource] = useState<AuthModalSource>('unknown');

  const openAuthModal = (mode: 'login' | 'register' = 'login', options?: OpenAuthModalOptions) => {
    const source = options?.source ?? 'unknown';
    setAuthMode(mode);
    setAuthModalSource(source);
    setIsAuthModalOpen(true);
    captureEvent('auth_modal_opened', { mode, source });
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthModalOpen,
        authMode,
        authModalSource,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
