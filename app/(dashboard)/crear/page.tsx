'use client';

import { useActiveBrand } from '@/hooks/useActiveBrand';
import { StudioHero } from './_components/StudioHero';
import { AgentOrchestra } from './_components/AgentOrchestra';
import { RecentWorkRail } from './_components/RecentWorkRail';
import { NextStepCard } from './_components/NextStepCard';
import { OnboardingHero } from './_components/OnboardingHero';

export default function CrearPage() {
  const { brands, isLoading } = useActiveBrand();
  const isFirstRun = !isLoading && brands.length === 0;

  return (
    <div className="space-y-10 pb-16">
      <StudioHero />

      {isFirstRun ? (
        <>
          <OnboardingHero />
          <AgentOrchestra />
        </>
      ) : (
        <>
          <NextStepCard />
          <AgentOrchestra />
          <RecentWorkRail />
        </>
      )}
    </div>
  );
}
