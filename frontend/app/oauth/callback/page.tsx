import { Suspense } from 'react';
import { OAuthCallbackClient } from '@/components/auth/OAuthCallbackClient';

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#050913] text-slate-400">
          Загрузка…
        </main>
      }
    >
      <OAuthCallbackClient />
    </Suspense>
  );
}
