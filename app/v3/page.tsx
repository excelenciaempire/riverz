import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { LandingNav } from '@/components/landing-v3/nav/LandingNav';
import { HeroSection } from '@/components/landing-v3/hero/HeroSection';
import { WhySection } from '@/components/landing-v3/why-ecommerce/WhySection';
import { ThesisSection } from '@/components/landing-v3/thesis/ThesisSection';
import { ResearchSection } from '@/components/landing-v3/features/ResearchSection';
import { StaticAdsSection } from '@/components/landing-v3/features/StaticAdsSection';
import { UgcSection } from '@/components/landing-v3/features/UgcSection';
import { LandingLabSection } from '@/components/landing-v3/features/LandingLabSection';
import { MetaAdsSection } from '@/components/landing-v3/features/MetaAdsSection';
import { StudioGallery } from '@/components/landing-v3/features/StudioGallery';
import { AgentsGridSection } from '@/components/landing-v3/agents/AgentsGridSection';
import { ModelsMarquee } from '@/components/landing-v3/models/ModelsMarquee';
import { FinalCtaSection } from '@/components/landing-v3/final/FinalCtaSection';
import { StickyCTA } from '@/components/landing-v3/final/StickyCTA';

export const metadata = {
  title: 'Riverz · Estudio Creativo IA para marcas de e-commerce',
  description:
    'Investigación profunda, anuncios estáticos, UGC con avatares, foto de producto, landing pages y Meta Ads — orquestado por agentes en una sola plataforma.',
};

export default async function LandingV3() {
  const { userId } = await auth();
  if (userId) {
    redirect('/crear');
  }

  return (
    <main className="lv3-page relative min-h-screen overflow-x-hidden">
      <LandingNav />
      <HeroSection />
      <WhySection />
      <ThesisSection />
      <ResearchSection />
      <StaticAdsSection />
      <UgcSection />
      <LandingLabSection />
      <MetaAdsSection />
      <StudioGallery />
      <AgentsGridSection />
      <ModelsMarquee />
      <FinalCtaSection />
      <StickyCTA />
    </main>
  );
}
