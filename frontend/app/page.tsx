'use client';

import { HeroSection } from '@/components/landing/HeroSection';
import { Footer } from '@/components/landing/Footer';

export default function HomePage() {
  return (
    <main className="bg-[#050913] text-white scroll-smooth min-h-screen flex flex-col">
      <HeroSection />
      <Footer />
    </main>
  );
}
