'use client';

import { HeroSection } from '@/components/landing/HeroSection';
import { Footer } from '@/components/landing/Footer';
import { DocumentLangSync } from '@/components/landing/DocumentLangSync';
import { LandingAuthHashHandler } from '@/components/landing/LandingAuthHashHandler';
import { useHumeTheme } from '@/lib/useHumeTheme';

function HomePageBody() {
  const isHume = useHumeTheme();

  return (
    <main
      className={`scroll-smooth min-h-screen flex flex-col ${
        isHume ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'bg-[#050913] text-white'
      }`}
    >
      <DocumentLangSync />
      <LandingAuthHashHandler />
      <HeroSection />
      <Footer />
    </main>
  );
}

export default function HomePage() {
  return <HomePageBody />;
}
