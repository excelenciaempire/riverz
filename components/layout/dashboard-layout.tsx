'use client';

import { Sidebar } from './sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-brand-dark-primary">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        {children}
      </main>
    </div>
  );
}

