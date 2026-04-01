'use client';

import { Button } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';

export type ProductType = 'jack' | 'wannanew';

interface ProductSelectionScreenProps {
  onSelect: (product: ProductType) => void;
}

export function ProductSelectionScreen({ onSelect }: ProductSelectionScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] gap-8 px-4">
      {/* Greeting */}
      <div className="text-center space-y-4 max-w-xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
          Привет! Я LEO, AI-помощник.
        </h1>
        <p className="text-base sm:text-lg text-slate-300">
          Выбери с чего хочешь начать:
        </p>
      </div>

      {/* Product Selection Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full max-w-2xl">
        {/* Jack - Job Matching */}
        <button
          onClick={() => onSelect('jack')}
          className="flex-1 group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur transition-all duration-300 hover:bg-white/[0.08] hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/10"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 group-hover:from-green-500/30 group-hover:to-green-600/30 transition-all duration-300">
              <SearchOutlined className="text-2xl text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                Подбор вакансий
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Соберу твой профиль и подберу идеальные вакансии под твой опыт
              </p>
            </div>
          </div>
          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </button>

        {/* Wannanew - PM Interview Prep */}
        <button
          onClick={() => onSelect('wannanew')}
          className="flex-1 group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur transition-all duration-300 hover:bg-white/[0.08] hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 group-hover:from-purple-500/30 group-hover:to-purple-600/30 transition-all duration-300">
              <FileTextOutlined className="text-2xl text-purple-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                Подготовка к собеседованию
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Проведу пробное интервью на Product Manager и дам персональный отчёт
              </p>
            </div>
          </div>
          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </button>
      </div>
    </div>
  );
}
