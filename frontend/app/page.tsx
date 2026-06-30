'use client';

import { HeroSection } from '@/components/landing/HeroSection';
import { Footer } from '@/components/landing/Footer';
import { DocumentLangSync } from '@/components/landing/DocumentLangSync';
import { LandingAuthHashHandler } from '@/components/landing/LandingAuthHashHandler';

function HomePageBody() {
  return (
    <main className="leo-app-shell scroll-smooth flex min-h-screen flex-col">
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
