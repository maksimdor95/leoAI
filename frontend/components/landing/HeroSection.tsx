'use client';

import { useAuth } from '@/contexts/AuthContext';
import { RobotOutlined, MessageOutlined, RocketOutlined, UserOutlined } from '@ant-design/icons';

const features = [
  {
    icon: <RobotOutlined className="text-4xl" />,
    title: 'Умный AI-ассистент',
    description:
      'LEO понимает твои предпочтения и цели, задает правильные вопросы и помогает найти идеальную работу.',
  },
  {
    icon: <MessageOutlined className="text-4xl" />,
    title: 'Персональный диалог',
    description:
      'Веди естественный диалог с LEO на русском языке. Он запомнит твои ответы и учтет их при подборе вакансий.',
  },
  {
    icon: <RocketOutlined className="text-4xl" />,
    title: 'Быстрый подбор',
    description:
      'Мы анализируем 10,000+ новых вакансий каждый час и отправляем персональные подборки прямо на email.',
  },
  {
    icon: <UserOutlined className="text-4xl" />,
    title: 'Прямые интро',
    description:
      'LEO может сделать прямое интро к менеджерам по найму через партнерскую сеть компаний.',
  },
];

export function HeroSection() {
  const { openAuthModal } = useAuth();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050913]">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050913] via-[#0a1a2e] to-[#050913] opacity-90" />

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }, (_, i) => {
          const positions = [
            { left: '10%', top: '20%', delay: '0s', duration: '3s' },
            { left: '80%', top: '10%', delay: '0.5s', duration: '4s' },
            { left: '30%', top: '60%', delay: '1s', duration: '3.5s' },
            { left: '70%', top: '50%', delay: '1.5s', duration: '4.5s' },
            { left: '20%', top: '80%', delay: '0.3s', duration: '3.8s' },
            { left: '90%', top: '70%', delay: '0.8s', duration: '4.2s' },
            { left: '50%', top: '30%', delay: '0.2s', duration: '3.2s' },
            { left: '40%', top: '90%', delay: '1.2s', duration: '4s' },
            { left: '60%', top: '15%', delay: '0.7s', duration: '3.7s' },
            { left: '15%', top: '40%', delay: '1.3s', duration: '4.3s' },
            { left: '85%', top: '45%', delay: '0.4s', duration: '3.4s' },
            { left: '25%', top: '5%', delay: '0.9s', duration: '4.1s' },
            { left: '75%', top: '85%', delay: '0.6s', duration: '3.6s' },
            { left: '5%', top: '55%', delay: '1.1s', duration: '4.4s' },
            { left: '95%', top: '35%', delay: '0.1s', duration: '3.3s' },
            { left: '45%', top: '75%', delay: '1.4s', duration: '4.6s' },
            { left: '55%', top: '25%', delay: '0.5s', duration: '3.9s' },
            { left: '35%', top: '95%', delay: '0.8s', duration: '4.2s' },
            { left: '65%', top: '65%', delay: '1.0s', duration: '3.5s' },
            { left: '12%', top: '12%', delay: '0.3s', duration: '4s' },
          ];
          const pos = positions[i] || { left: '50%', top: '50%', delay: '0s', duration: '3s' };
          return (
            <div
              key={i}
              className="absolute w-1 h-1 bg-green-500/20 rounded-full animate-float"
              style={{
                left: pos.left,
                top: pos.top,
                animationDelay: pos.delay,
                animationDuration: pos.duration,
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 animate-fadeIn">
        <div className="text-center">
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-white mb-6 leading-tight animate-gradient-text">
            LEO AI
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto">
            Ваш персональный AI-ассистент для поиска работы.
            <br />
            Находим идеальные вакансии, которые подходят именно вам.
          </p>

          <div className="flex justify-center items-center mb-16">
            <button
              onClick={() => openAuthModal('register')}
              className="px-8 py-4 bg-green-500 text-white text-lg font-semibold rounded-full shadow-xl hover:bg-green-400 transition-all hover:scale-105 active:scale-95"
            >
              Начать поиск работы
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Почему выбирают?</h2>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
              Современный подход к поиску работы с использованием искусственного интеллекта
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-8 hover:bg-white/[0.06] hover:-translate-y-2 transition-all cursor-pointer animate-fadeIn"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-green-500 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
