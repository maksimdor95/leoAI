'use client';

import { RobotOutlined, MessageOutlined, RocketOutlined, UserOutlined } from '@ant-design/icons';

const features = [
  {
    icon: <RobotOutlined className="text-4xl" />,
    title: 'Умный AI-ассистент',
    description:
      'Jack понимает твои предпочтения и цели, задает правильные вопросы и помогает найти идеальную работу.',
  },
  {
    icon: <MessageOutlined className="text-4xl" />,
    title: 'Персональный диалог',
    description:
      'Веди естественный диалог с Jack на русском языке. Он запомнит твои ответы и учтет их при подборе вакансий.',
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
      'Jack может сделать прямое интро к менеджерам по найму через партнерскую сеть компаний.',
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-[#050913] relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 animate-fadeIn">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Почему выбирают Jack AI?
          </h2>
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
    </section>
  );
}
