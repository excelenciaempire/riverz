'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'rvz_sidebar_collapsed';

// Rutas donde la sidebar arranca colapsada por defecto (pantallas que necesitan
// más ancho horizontal, como la grilla tipo Kitchn).
const FORCE_COLLAPSED_PREFIXES = ['/campanas/meta/crear'];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const forcedCollapse = FORCE_COLLAPSED_PREFIXES.some((p) =>
    pathname?.startsWith(p),
  );

  useEffect(() => {
    if (forcedCollapse) {
      setCollapsed(true);
      setHydrated(true);
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === '1') setCollapsed(true);
      else setCollapsed(false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [forcedCollapse]);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        // Sólo persistimos si no estamos en una ruta que fuerza el estado.
        if (!forcedCollapse) localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="app-v2 flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main
        className={cn(
          'flex-1 min-w-0 transition-[margin] duration-200 ease-out',
          collapsed ? 'ml-0' : 'ml-56',
          !hydrated && (forcedCollapse ? 'ml-0' : 'ml-56'),
        )}
      >
        <div className="mx-auto max-w-[1480px] p-6 md:p-9">{children}</div>
      </main>
    </div>
  );
}
