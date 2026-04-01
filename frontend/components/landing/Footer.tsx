'use client';

export function Footer() {
  return (
    <footer className="bg-[#050913] border-t border-white/10 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">LEO AI</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Ваш персональный AI-ассистент для поиска работы. Находим идеальные вакансии, которые
              подходят именно вам.
            </p>
          </div>

          <div>
            <h4 className="text-white text-lg font-semibold mb-4">Навигация</h4>
            <ul className="space-y-2 text-slate-300 text-sm">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Возможности
                </a>
              </li>
              <li>
                <a href="#auth" className="hover:text-white transition-colors">
                  Регистрация
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-lg font-semibold mb-4">Контакты</h4>
            <p className="text-slate-300 text-sm">
              Email:{' '}
              <a href="mailto:hello@jackai.com" className="hover:text-white transition-colors">
                hello@jackai.com
              </a>
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 text-center text-slate-400 text-sm">
          <p>© 2025 LEO AI. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
