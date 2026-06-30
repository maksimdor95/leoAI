'use client';

import Link from 'next/link';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { DocumentLangSync } from '@/components/landing/DocumentLangSync';
import {
  getLegalDocument,
  legalContactParagraph,
} from '@/lib/legalUiCopy';

type LegalDocumentPageProps = {
  kind: 'privacy' | 'terms';
};

export function LegalDocumentPage({ kind }: LegalDocumentPageProps) {
  const { settings } = useAppSettings();
  const doc = getLegalDocument(kind, settings.locale);
  const contact = legalContactParagraph(settings.locale, kind);
  const telegramStart = kind === 'privacy' ? 'privacy' : 'terms';

  return (
    <main className="leo-app-shell min-h-screen">
      <DocumentLangSync />
      <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <div className="mb-6">
          <Link href="/" className="leo-app-shell-link text-sm transition-colors">
            {doc.backHome}
          </Link>
        </div>

        <div className="leo-surface-card rounded-3xl border p-6 sm:p-10">
          <p className="leo-app-shell-muted text-sm uppercase tracking-[0.24em]">LEO AI</p>
          <h1 className="leo-app-shell-heading mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            {doc.pageTitle}
          </h1>
          <p className="leo-app-shell-muted mt-5 text-sm leading-relaxed">{doc.intro}</p>

          <div className="mt-10 space-y-8">
            {doc.sections.map((section) => (
              <section key={section.title}>
                <h2 className="leo-app-shell-heading text-xl font-semibold">{section.title}</h2>
                <div className="mt-3 space-y-3">
                  {section.text.map((paragraph) => (
                    <p key={paragraph} className="leo-app-shell-body text-sm leading-7">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div
            className={`leo-surface-card-muted mt-10 rounded-2xl border p-5 ${
              kind === 'privacy' ? 'leo-surface-card-muted--privacy' : ''
            }`}
          >
            <h2 className="leo-app-shell-heading text-lg font-semibold">{doc.contactTitle}</h2>
            <p className="leo-app-shell-body mt-2 text-sm leading-7">
              {contact.beforeEmail}
              <a href="mailto:hello@leo-ai.ru" className="leo-app-shell-link">
                hello@leo-ai.ru
              </a>
              {contact.beforeTelegram}
              <a
                href={`https://t.me/leoaisupportbot?start=${telegramStart}`}
                target="_blank"
                rel="noopener noreferrer"
                className="leo-app-shell-link"
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
