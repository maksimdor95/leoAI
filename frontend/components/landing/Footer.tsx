'use client';

import { useEffect, useState } from 'react';
import { getBoostyUrl } from '@/lib/boostyLink';
import { buildTelegramSupportUrl, getTelegramSupportUrl } from '@/lib/supportLink';

const boostyUrl = getBoostyUrl();

const linkClass = 'text-slate-300 hover:text-green-200 transition-colors';
const defaultSupportUrl = buildTelegramSupportUrl();

export function Footer() {
  const [supportBotUrl, setSupportBotUrl] = useState(defaultSupportUrl);

  useEffect(() => {
    setSupportBotUrl(getTelegramSupportUrl());
  }, []);

  return (
    <footer className="bg-gradient-to-b from-[#07111f] to-[#050913] border-t border-white/10 py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.25fr_0.85fr_1fr]">
          <div className="max-w-sm">
            <h3 className="text-white text-xl font-semibold tracking-tight">LEO AI</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Находим идеальные вакансии, которые подходят именно вам, и помогаем с подготовкой.
            </p>
          </div>

          <div>
            <h4 className="text-white text-base font-semibold">Навигация</h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="#features" className={linkClass}>
                  Возможности
                </a>
              </li>
              <li>
                <a href="#auth" className={linkClass}>
                  Регистрация
                </a>
              </li>
              <li>
                <a href="/privacy" className={linkClass}>
                  Политика конфиденциальности
                </a>
              </li>
              <li>
                <a href="/terms" className={linkClass}>
                  Условия использования
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-base font-semibold">Контакты</h4>
            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="text-slate-400">Email: </span>
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
                  Обратная связь в Telegram
                </a>
              </p>
              <p>
                <a
                  href={boostyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Поддержать на Boosty
                </a>
              </p>
              <p className="max-w-xs text-xs leading-6 text-slate-500">
                Для поддержки не передавайте пароли, токены и банковские данные.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-white">Нужна помощь?</p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                Напишите в Telegram-бота поддержки по вопросам аккаунта, подбора вакансий или
                подготовки к интервью. Команда LEO AI ответит в чате.
              </p>
            </div>
            <a
              href={supportBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-green-300/30 bg-green-400/10 px-5 py-2.5 text-sm font-semibold text-green-100 shadow-lg shadow-green-950/20 transition-colors hover:bg-green-400/20 hover:text-white"
            >
              Написать в поддержку
            </a>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© 2025 LEO AI. Все права защищены.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="/privacy" className="text-slate-400 hover:text-green-200 transition-colors">
              Политика конфиденциальности
            </a>
            <a href="/terms" className="text-slate-400 hover:text-green-200 transition-colors">
              Условия использования
            </a>
            <a
              href={supportBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-green-200 transition-colors"
            >
              Обратная связь
            </a>
            <a
              href={boostyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-green-200 transition-colors"
            >
              Boosty
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
