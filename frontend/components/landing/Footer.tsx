'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { getBoostyUrl } from '@/lib/boostyLink';
import { landingUi } from '@/lib/landingUiCopy';
import { useHumeTheme } from '@/lib/useHumeTheme';
import { buildTelegramSupportUrl, getTelegramSupportUrl } from '@/lib/supportLink';

const boostyUrl = getBoostyUrl();
const defaultSupportUrl = buildTelegramSupportUrl();

export function Footer() {
  const { openAuthModal } = useAuth();
  const { settings } = useAppSettings();
  const isHume = useHumeTheme();
  const copy = landingUi(settings.locale);
  const [supportBotUrl, setSupportBotUrl] = useState(defaultSupportUrl);

  useEffect(() => {
    setSupportBotUrl(getTelegramSupportUrl());
  }, []);

  const linkClass = isHume
    ? 'text-[var(--color-smoke)] transition-colors hover:text-[var(--color-ink)]'
    : 'text-slate-300 transition-colors hover:text-green-200';

  const footerNavLinkClass = `${linkClass} underline underline-offset-2 decoration-current/70 hover:decoration-current`;

  const footerNavButtonClass = `${footerNavLinkClass} appearance-none border-0 bg-transparent p-0 font-inherit cursor-pointer outline-none shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0`;

  return (
    <footer className="leo-footer-shell border-t py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.25fr_0.85fr_1fr]">
          <div className="max-w-sm">
            <h3
              className={`text-xl font-semibold tracking-tight ${
                isHume ? 'text-[var(--color-ink)]' : 'text-white'
              }`}
            >
              LEO AI
            </h3>
            <p
              className={`mt-4 text-sm leading-7 ${
                isHume ? 'text-[var(--color-smoke)]' : 'text-slate-300'
              }`}
            >
              {copy.footerTagline}
            </p>
          </div>

          <div>
            <h4 className={`text-base font-semibold ${isHume ? 'text-[var(--color-ink)]' : 'text-white'}`}>
              {copy.footerNav}
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="#features" className={footerNavLinkClass}>
                  {copy.footerFeatures}
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openAuthModal('register', { source: 'footer_register' })}
                  className={footerNavButtonClass}
                >
                  {copy.footerRegister}
                </button>
              </li>
              <li>
                <a href="/privacy" className={footerNavLinkClass}>
                  {copy.footerPrivacy}
                </a>
              </li>
              <li>
                <a href="/terms" className={footerNavLinkClass}>
                  {copy.footerTerms}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={`text-base font-semibold ${isHume ? 'text-[var(--color-ink)]' : 'text-white'}`}>
              {copy.footerContacts}
            </h4>
            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className={isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'}>Email: </span>
                <a href="mailto:hello@leo-ai.ru" className={linkClass}>
                  hello@leo-ai.ru
                </a>
              </p>
              <p>
                <a
                  href={supportBotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  {copy.footerTelegram}
                </a>
              </p>
              <p>
                <a href={boostyUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {copy.footerBoosty}
                </a>
              </p>
              <p
                className={`max-w-xs text-xs leading-6 ${
                  isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'
                }`}
              >
                {copy.footerSecurityNote}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`mt-10 rounded-3xl border p-5 shadow-2xl sm:p-6 ${
            isHume
              ? 'border-[rgba(34,34,34,0.08)] bg-[var(--color-bone)] shadow-[rgba(34,34,34,0.06)]'
              : 'border-white/10 bg-white/[0.04] shadow-black/20'
          }`}
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className={`text-sm font-medium ${isHume ? 'text-[var(--color-ink)]' : 'text-white'}`}>
                {copy.footerHelpTitle}
              </p>
              <p
                className={`mt-2 max-w-3xl text-sm leading-7 ${
                  isHume ? 'text-[var(--color-smoke)]' : 'text-slate-300'
                }`}
              >
                {copy.footerHelpBody}
              </p>
            </div>
            <a
              href={supportBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={
                isHume
                  ? 'inline-flex shrink-0 items-center justify-center rounded-full border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bone)]'
                  : 'inline-flex shrink-0 items-center justify-center rounded-full border border-green-300/30 bg-green-400/10 px-5 py-2.5 text-sm font-semibold text-green-100 shadow-lg shadow-green-950/20 transition-colors hover:bg-green-400/20 hover:text-white'
              }
            >
              {copy.footerHelpCta}
            </a>
          </div>
        </div>

        <div
          className={`mt-10 flex flex-col items-center justify-between gap-4 border-t pt-8 text-sm md:flex-row ${
            isHume ? 'border-[rgba(34,34,34,0.08)] text-[var(--color-smoke)]' : 'border-white/10 text-slate-500'
          }`}
        >
          <p>{copy.footerCopyright}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:justify-end">
            <a href="/privacy" className={linkClass}>
              {copy.footerPrivacy}
            </a>
            <a href="/terms" className={linkClass}>
              {copy.footerTerms}
            </a>
            <a href={supportBotUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {copy.footerFeedback}
            </a>
            <a href={boostyUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Boosty
            </a>
            <Link href="/settings" className={footerNavLinkClass}>
              {copy.footerSettings}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
