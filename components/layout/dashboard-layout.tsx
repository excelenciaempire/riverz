'use client';

import { Sidebar } from './sidebar';
import { useCredits } from '@/hooks/useCredits';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { credits } = useCredits();

  return (
    <div className="flex min-h-screen bg-brand-dark-primary">
      <Sidebar />
      <main className="ml-64 flex-1">
        {/* Top bar with credits */}
        <div className="flex justify-end border-b border-gray-800 px-8 py-6">
          <div className="text-right">
            <p className="text-lg font-semibold text-white">{credits} Creditos</p>
          </div>
        </div>
        
        {/* Main content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

