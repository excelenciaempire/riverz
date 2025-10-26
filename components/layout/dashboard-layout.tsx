'use client';

import { Sidebar } from './sidebar';
import { useCredits } from '@/hooks/useCredits';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { credits } = useCredits();

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="ml-64 flex-1 min-w-0">
        {/* Top bar with credits */}
        <div className="flex justify-end border-b border-gray-900 bg-black px-10 py-5 sticky top-0 z-10">
          <div className="text-right">
            <p className="text-base font-medium text-white">{credits} Creditos</p>
          </div>
        </div>
        
        {/* Main content */}
        <div className="p-10 max-w-[1800px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

