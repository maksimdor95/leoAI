'use client';

import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/landing/AuthModal';

export function GlobalAuthModal() {
  const { isAuthModalOpen, authMode, closeAuthModal } = useAuth();

  return <AuthModal open={isAuthModalOpen} onClose={closeAuthModal} initialMode={authMode} />;
}
