import { Suspense } from 'react';
import { OAuthCallbackClient } from '@/components/auth/OAuthCallbackClient';

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[var(--color-bone)] text-[var(--color-smoke)]">
          Загрузка…
        </main>
      }
    >
      <OAuthCallbackClient />
    </Suspense>
  );
}
