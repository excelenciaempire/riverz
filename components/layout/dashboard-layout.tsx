'use client';

import { Sidebar } from './sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="ml-56 flex-1 min-w-0">
        {/* Main content with padding */}
        <div className="max-w-[1800px] mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

