import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { LandingNav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { Differentiator } from '@/components/landing/differentiator';
import { AgentsGrid } from '@/components/landing/agents-grid';
import { Capabilities } from '@/components/landing/capabilities';
import { Pipeline } from '@/components/landing/pipeline';
import { UseCases } from '@/components/landing/use-cases';
import { FinalCTA } from '@/components/landing/final-cta';
import { StickyCTA } from '@/components/landing/sticky-cta';
import { RevealOnScroll } from '@/components/landing/reveal';

export const metadata = {
  title: 'Riverz · Estudio Creativo IA para marcas',
  description:
    'Una plataforma. Todos los modelos. Producí UGC, anuncios estáticos, foto de producto y video con la velocidad de la IA y el control de un creativo.',
};

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect('/crear');
  }

  return (
    <main className="lv2-page relative min-h-screen overflow-x-hidden">
      <RevealOnScroll />
      <LandingNav />
      <Hero />
      <Differentiator />
      <AgentsGrid />
      <Capabilities />
      <Pipeline />
      <UseCases />
      <FinalCTA />
      <StickyCTA />
    </main>
  );
}
