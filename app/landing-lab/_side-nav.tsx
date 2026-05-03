'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { ArrowLeft, Home, FileText, Store, Sparkles, Key, PlayCircle, Gift } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';

/**
 * Landing Lab side rail. Matches the visual language of the main Riverz
 * sidebar (components/layout/sidebar.tsx) so /landing-lab feels like part of
 * the same product instead of a one-off dark surface.
 *
 * Three nav items per the user's spec:
 *   Inicio        → /landing-lab
 *   Mis Páginas   → /landing-lab/mis-paginas
 *   Tienda        → /configuracion?tab=integrations (reuses existing UI)
 *
 * "Volver" at the very top exits the Lab back to the main /dashboard.
 * Footer carries the UserButton + credits counter, same as the main
 * sidebar, so the user always knows their plan state.
 */
export function SideNav({ active }: {
  active?:
    | 'inicio'
    | 'mis-paginas'
    | 'tienda'
    | 'creative-studio'
    | 'api-keys'
    | 'tutorial'
    | 'refer';
}) {
  const { credits } = useCredits();

  return (
    <div className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col border-r border-gray-900 bg-black">
      {/* Volver row */}
      <div className="flex h-12 items-center px-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-gray-400 transition-all hover:bg-gray-900 hover:text-white"
        >
          <ArrowLeft className="h-3 w-3 shrink-0" />
          <span>Volver</span>
        </Link>
      </div>

      {/* Brand */}
      <div className="flex h-10 items-center px-3">
        <h1 className="text-xl font-bold tracking-wider text-[#07A498]">RIVERZ</h1>
      </div>

      <nav className="flex-1 overflow-hidden px-3 py-2 hover:overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
        <div className="mb-3">
          <h3 className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
            Landing Lab
          </h3>
          <div className="space-y-0.5">
            <NavItem href="/landing-lab" icon={Home} label="Inicio" active={active === 'inicio'} />
            <NavItem href="/landing-lab/mis-paginas" icon={FileText} label="Mis Páginas" active={active === 'mis-paginas'} />
            <NavItem
              href="/landing-lab/creative-studio"
              icon={Sparkles}
              label="Creative Studio"
              active={active === 'creative-studio'}
              badge="New"
            />
          </div>
        </div>

        <div className="mb-3">
          <h3 className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
            Conexión
          </h3>
          <div className="space-y-0.5">
            <NavItem href="/landing-lab/stores" icon={Store} label="Tiendas" active={active === 'tienda'} />
            <NavItem
              href="/landing-lab/api-keys"
              icon={Key}
              label="API Keys"
              active={active === 'api-keys'}
              badge="Beta"
            />
          </div>
        </div>

        <div className="mb-3">
          <h3 className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
            Más
          </h3>
          <div className="space-y-0.5">
            <NavItem href="/landing-lab/tutorial" icon={PlayCircle} label="Tutorial" active={active === 'tutorial'} />
            <NavItem
              href="/landing-lab/refer"
              icon={Gift}
              label="Invita y gana"
              active={active === 'refer'}
              badge="+Créditos"
            />
          </div>
        </div>
      </nav>

      {/* Footer — UserButton + credits counter, same as the main Riverz sidebar */}
      <div className="border-t border-gray-900 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="origin-left scale-90">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
          <div className="text-right">
            <p className="text-[9px] text-gray-500">Créditos</p>
            <p className="text-xs font-bold text-[#07A498]">{credits ?? 0}</p>
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
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all',
        active
          ? 'bg-[#07A498]/10 text-[#07A498]'
          : 'text-gray-400 hover:bg-gray-900 hover:text-white',
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="rounded-full bg-[#07A498]/20 px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-wider text-[#07A498]">
          {badge}
        </span>
      )}
    </Link>
  );
}
