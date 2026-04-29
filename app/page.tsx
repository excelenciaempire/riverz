import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { LandingNav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { ScrollManifesto } from '@/components/landing/scroll-manifesto';
import { Differentiator } from '@/components/landing/differentiator';
import { Specialists } from '@/components/landing/specialists';
import { Pipeline } from '@/components/landing/pipeline';
import { Capabilities } from '@/components/landing/capabilities';
import { Stats } from '@/components/landing/stats';
import { UseCases } from '@/components/landing/use-cases';
import { FinalCTA } from '@/components/landing/final-cta';
import { LandingFooter } from '@/components/landing/footer';
import { SmoothScroll } from '@/components/landing/smooth-scroll';

export const metadata = {
  title: 'Riverz · El estudio creativo con IA para marcas que venden',
  description:
    'Produce UGC, anuncios estáticos, foto de producto y video para tu marca de e-commerce. Tu equipo creativo de IA — listo para Meta, TikTok y tu tienda.',
};

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect('/crear');

  return (
    <SmoothScroll>
      <main className="relative min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">
        <LandingNav />
        <Hero />
        <ScrollManifesto />
        <Differentiator />
        <Specialists />
        <Pipeline />
        <Capabilities />
        <Stats />
        <UseCases />
        <FinalCTA />
        <LandingFooter />
      </main>
    </SmoothScroll>
  );
}
