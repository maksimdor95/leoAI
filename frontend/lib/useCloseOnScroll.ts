'use client';

import { useEffect } from 'react';

/** Закрывает оверлей при скролле любого предка — попап не «уезжает» от триггера. */
export function useCloseOnScroll(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open, onClose]);
}
