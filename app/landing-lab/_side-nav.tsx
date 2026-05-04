'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { ArrowLeft, Home, FileText, Store, Moon, Sun } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme/theme-provider';

/**
 * Landing Lab side rail. Matches the visual language of the main Riverz
 * sidebar (components/layout/sidebar.tsx) so /landing-lab feels like part of
 * the same product instead of a one-off surface.
 *
 * "Volver" exits to /crear (the user-facing dashboard, NOT /dashboard which
 * is the admin panel).
 */
export function SideNav({ active }: { active?: 'inicio' | 'mis-paginas' | 'tienda' }) {
  const { credits } = useCredits();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-v2-sidebar fixed left-0 top-0 z-30 flex h-screen w-56 flex-col">
      <div className="flex h-12 items-center px-3">
        <Link href="/crear" className="app-v2-sidebar-link">
          <ArrowLeft className="h-3 w-3 shrink-0" />
          <span>Volver</span>
        </Link>
      </div>

      <div className="flex h-12 items-center px-4">
        <Link href="/crear" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--rvz-accent)] text-[12px] font-bold text-[var(--rvz-accent-fg)]">
            R
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Riverz</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-hidden px-3 py-2 hover:overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
        <div className="mb-4">
          <h3 className="app-v2-sidebar-group">Landing Lab</h3>
          <div className="space-y-0.5">
            <NavItem href="/landing-lab" icon={Home} label="Inicio" active={active === 'inicio'} />
            <NavItem
              href="/landing-lab/mis-paginas"
              icon={FileText}
              label="Mis Páginas"
              active={active === 'mis-paginas'}
            />
          </div>
        </div>

        <div className="mb-4">
          <h3 className="app-v2-sidebar-group">Conexión</h3>
          <div className="space-y-0.5">
            <NavItem
              href="/landing-lab/tienda"
              icon={Store}
              label="Tienda"
              active={active === 'tienda'}
            />
          </div>
        </div>
      </nav>

      <div className="border-t border-[var(--rvz-sidebar-border)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="origin-left scale-90">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              className="grid h-7 w-7 place-items-center rounded-md border border-[var(--rvz-sidebar-border)] text-[var(--rvz-sidebar-fg-muted)] transition hover:border-[var(--rvz-accent)] hover:text-[var(--rvz-accent)]"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.16em] text-[var(--rvz-sidebar-fg-faint)]">
                Créditos
              </p>
              <p className="text-[13px] font-bold text-[var(--rvz-accent)]">{credits ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <Link href={href} className={cn('app-v2-sidebar-link', active && 'is-active')}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
