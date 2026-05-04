'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useClerk } from '@clerk/nextjs';
import {
  Package,
  History,
  Settings,
  LogOut,
  Layout,
  Video,
  FileVideo,
  Image as ImageIcon,
  FlaskConical,
  Megaphone,
  Wand2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';

const navigationGroups = [
  {
    title: 'Imagenes',
    items: [
      { name: 'Static Ads', href: '/crear/static-ads', icon: Layout },
      { name: 'Editar Foto', href: '/crear/editar-foto', icon: ImageIcon },
      { name: 'Historial', href: '/crear/static-ads/historial', icon: History },
    ],
  },
  {
    title: 'Videos',
    items: [
      { name: 'Crear', href: '/crear', icon: Video },
      { name: 'UGC', href: '/crear/ugc', icon: FileVideo },
      { name: 'Clips', href: '/crear/clips', icon: FileVideo },
      { name: 'Stealer', href: '/crear/stealer', icon: Wand2 },
    ],
  },
  {
    title: 'Marca',
    items: [
      { name: 'Mis Productos', href: '/marcas', icon: Package },
    ],
  },
  {
    title: 'Landings',
    items: [
      { name: 'Landing Lab', href: '/landing-lab', icon: FlaskConical },
    ],
  },
  {
    title: 'Campañas',
    items: [
      { name: 'Meta Ads', href: '/campanas/meta', icon: Megaphone },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { credits } = useCredits();
  const { signOut } = useClerk();

  return (
    <>
      {/* Floating reopen button when collapsed */}
      {collapsed && (
        <button
          onClick={onToggle}
          aria-label="Mostrar menú"
          className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-[#1a1a22] bg-[#0e0e13] text-[#fafaf7]/70 backdrop-blur-md transition-colors hover:border-[#f7ff9e] hover:text-white"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <div
        className={cn(
          'app-v2-sidebar fixed left-0 top-0 z-30 flex h-screen w-56 flex-col transition-transform duration-200 ease-out',
          collapsed && '-translate-x-full',
        )}
      >
        {/* Logo + collapse button */}
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/crear" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[#f7ff9e] text-[12px] font-bold text-black">
              R
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Riverz</span>
          </Link>
          <button
            onClick={onToggle}
            aria-label="Ocultar menú"
            className="rounded-md p-1 text-[#fafaf7]/40 transition-colors hover:bg-white/5 hover:text-[#fafaf7]"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-hidden px-3 py-2 hover:overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {navigationGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <h3 className="app-v2-sidebar-group">{group.title}</h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/crear' && pathname.startsWith(item.href + '/'));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'app-v2-sidebar-link',
                        isActive && 'is-active',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-[#1a1a22] px-3 py-2">
          <Link
            href="/configuracion"
            className={cn(
              'app-v2-sidebar-link',
              pathname === '/configuracion' && 'is-active',
            )}
          >
            <Settings className="h-3.5 w-3.5 shrink-0" />
            <span>Configuración</span>
          </Link>

          <button
            onClick={() => signOut(() => (window.location.href = '/'))}
            className="app-v2-sidebar-link w-full text-left hover:!bg-red-500/10 hover:!text-red-300"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        <div className="border-t border-[#1a1a22] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="origin-left scale-90">
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.16em] text-[#fafaf7]/40">Créditos</p>
              <p className="text-[13px] font-bold text-[#f7ff9e]">{credits ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
