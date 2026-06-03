'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Временно скрыт — редирект на выбор сценария. Полная реализация: git history этого файла. */
export default function CareerOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/chat?new=true');
  }, [router]);

  return null;
}
