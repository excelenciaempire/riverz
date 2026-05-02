import { Suspense } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ActiveBrandProvider } from '@/hooks/useActiveBrand';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ActiveBrandProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </ActiveBrandProvider>
    </Suspense>
  );
}
