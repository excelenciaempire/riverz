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
          className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-gray-800 bg-black/70 text-gray-300 backdrop-blur-md transition-colors hover:border-[#07A498] hover:text-white"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <div
        className={cn(
          'fixed left-0 top-0 z-30 flex h-screen w-56 flex-col border-r border-gray-900 bg-black transition-transform duration-200 ease-out',
          collapsed && '-translate-x-full',
        )}
      >
        {/* Logo + collapse button */}
        <div className="flex h-12 items-center justify-between px-3">
          <h1 className="text-xl font-bold tracking-wider text-[#07A498]">RIVERZ</h1>
          <button
            onClick={onToggle}
            aria-label="Ocultar menú"
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-900 hover:text-gray-200"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-hidden px-3 py-2 hover:overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {navigationGroups.map((group) => (
            <div key={group.title} className="mb-3">
              <h3 className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                {group.title}
              </h3>
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
                        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all',
                        isActive
                          ? 'bg-[#07A498]/10 text-[#07A498]'
                          : 'text-gray-400 hover:bg-gray-900 hover:text-white',
                      )}
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-gray-900 px-3 py-2">
          <Link
            href="/configuracion"
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-gray-400 transition-all hover:bg-gray-900 hover:text-white',
              pathname === '/configuracion' && 'bg-[#07A498]/10 text-[#07A498]',
            )}
          >
            <Settings className="h-3 w-3 shrink-0" />
            <span>Configuración</span>
          </Link>

          <button
            onClick={() => signOut(() => (window.location.href = '/'))}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-gray-400 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-3 w-3 shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

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
    </>
  );
}
