'use client';

import Link from 'next/link';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { DocumentLangSync } from '@/components/landing/DocumentLangSync';
import { AppSettingsForm } from '@/components/settings/AppSettingsForm';
import { landingUi } from '@/lib/landingUiCopy';

export function AppSettingsPage() {
  const { settings } = useAppSettings();
  const copy = landingUi(settings.locale);

  return (
    <main className="leo-app-shell min-h-screen">
      <DocumentLangSync />
      <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <div className="mb-6">
          <Link href="/" className="leo-app-shell-link text-sm transition-colors">
            {copy.settingsBackHome}
          </Link>
        </div>

        <div className="leo-surface-card rounded-3xl border p-6 sm:p-10">
          <p className="leo-app-shell-muted text-sm uppercase tracking-[0.24em]">LEO AI</p>
          <h1 className="leo-app-shell-heading mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            {copy.settingsPageTitle}
          </h1>
          <p className="leo-app-shell-muted mt-5 text-sm leading-relaxed">{copy.settingsPageIntro}</p>

          <div className="mt-10">
            <AppSettingsForm />
          </div>
        </div>
      </section>
    </main>
  );
}
