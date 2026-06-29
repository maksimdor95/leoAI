'use client';

import Link from 'next/link';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { AppSettingsMenu } from '@/components/chat/AppSettingsMenu';
import { DocumentLangSync } from '@/components/landing/DocumentLangSync';
import {
  getLegalDocument,
  legalContactParagraph,
} from '@/lib/legalUiCopy';
import { useHumeTheme } from '@/lib/useHumeTheme';

type LegalDocumentPageProps = {
  kind: 'privacy' | 'terms';
};

export function LegalDocumentPage({ kind }: LegalDocumentPageProps) {
  const { settings } = useAppSettings();
  const isHume = useHumeTheme();
  const doc = getLegalDocument(kind, settings.locale);
  const contact = legalContactParagraph(settings.locale, kind);
  const telegramStart = kind === 'privacy' ? 'privacy' : 'terms';

  return (
    <main
      className={`min-h-screen ${
        isHume ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'bg-[#050913] text-white'
      }`}
    >
      <DocumentLangSync />
      <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className={`text-sm transition-colors ${
              isHume
                ? 'text-[var(--color-smoke)] hover:text-[var(--color-ink)]'
                : 'text-green-300 hover:text-green-200'
            }`}
          >
            {doc.backHome}
          </Link>
          <AppSettingsMenu scope="landing" />
        </div>

        <div
          className={`rounded-3xl border p-6 sm:p-10 ${
            isHume
              ? 'border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)]'
              : 'border-white/10 bg-white/[0.04]'
          }`}
        >
          <p
            className={`text-sm uppercase tracking-[0.24em] ${
              isHume ? 'text-[var(--color-smoke)]' : 'text-green-300/80'
            }`}
          >
            LEO AI
          </p>
          <h1
            className={`mt-4 text-3xl font-semibold tracking-tight sm:text-5xl ${
              isHume ? 'hume-heading' : ''
            }`}
          >
            {doc.pageTitle}
          </h1>
          <p
            className={`mt-5 text-sm leading-relaxed ${
              isHume ? 'hume-body-sm' : 'text-slate-400'
            }`}
          >
            {doc.intro}
          </p>

          <div className="mt-10 space-y-8">
            {doc.sections.map((section) => (
              <section key={section.title}>
                <h2
                  className={`text-xl font-semibold ${
                    isHume ? 'hume-heading !text-lg' : 'text-white'
                  }`}
                >
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3">
                  {section.text.map((paragraph) => (
                    <p
                      key={paragraph}
                      className={`text-sm leading-7 ${
                        isHume ? 'hume-body-sm' : 'text-slate-300'
                      }`}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div
            className={`mt-10 rounded-2xl border p-5 ${
              isHume
                ? 'border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]'
                : kind === 'privacy'
                  ? 'border-green-400/20 bg-green-400/10'
                  : 'border-white/10 bg-white/[0.04]'
            }`}
          >
            <h2
              className={`text-lg font-semibold ${
                isHume ? 'hume-heading !text-base' : kind === 'privacy' ? 'text-green-100' : 'text-white'
              }`}
            >
              {doc.contactTitle}
            </h2>
            <p
              className={`mt-2 text-sm leading-7 ${
                isHume ? 'hume-body-sm' : 'text-slate-300'
              }`}
            >
              {contact.beforeEmail}
              <a
                href="mailto:hello@leo-ai.ru"
                className={
                  isHume
                    ? 'text-[var(--color-iris)] hover:underline'
                    : 'text-green-300 hover:text-green-200'
                }
              >
                hello@leo-ai.ru
              </a>
              {contact.beforeTelegram}
              <a
                href={`https://t.me/leoaisupportbot?start=${telegramStart}`}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  isHume
                    ? 'text-[var(--color-iris)] hover:underline'
                    : 'text-green-300 hover:text-green-200'
                }
              >
                @leoaisupportbot
              </a>
              {contact.afterTelegram}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
