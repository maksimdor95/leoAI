'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/** Opens auth modal when landing links use `#auth` or `#auth?register=true`. */
export function LandingAuthHashHandler() {
  const { openAuthModal } = useAuth();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#auth')) return;

    const register = hash.includes('register=true');
    openAuthModal(register ? 'register' : 'login', { source: 'hash_link' });
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [openAuthModal]);

  return null;
}
