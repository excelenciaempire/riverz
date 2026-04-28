'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'rvz_sidebar_collapsed';

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main
        className={cn(
          'flex-1 min-w-0 transition-[margin] duration-200 ease-out',
          collapsed ? 'ml-0' : 'ml-56',
          !hydrated && 'ml-56',
        )}
      >
        <div className="mx-auto max-w-[1800px] p-8">{children}</div>
      </main>
    </div>
  );
}
