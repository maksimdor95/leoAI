'use client';

import { HeroSection } from '@/components/landing/HeroSection';
import Link from 'next/link';
import { Button } from 'antd';

export default function HomePage() {
  return (
    <main className="bg-[#050913] text-white scroll-smooth min-h-screen flex flex-col">
      <HeroSection />
      <section className="relative z-10 border-t border-white/5 bg-[#050913]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-6 sm:px-8 sm:py-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-green-300/80 mb-1">
              Stage 1 · AI Career Learning
            </p>
            <p className="text-sm sm:text-base text-slate-300">
              Хотите оценить, насколько вы готовы к работе с AI в своей профессии?
            </p>
          </div>
          <Link href="/career/onboarding">
            <Button
              type="primary"
              size="large"
              className="rounded-full border-none bg-green-500 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-green-400"
            >
              Start AI Career Analysis
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
