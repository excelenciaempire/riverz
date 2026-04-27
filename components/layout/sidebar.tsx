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
      { name: 'Meta Ads', href: '/campañas/meta', icon: Megaphone },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { credits } = useCredits();
  const { signOut } = useClerk();

  return (
    <div className="fixed left-0 top-0 flex h-screen w-56 flex-col bg-black border-r border-gray-900">
      {/* Logo */}
      <div className="flex h-12 items-center justify-center">
        <h1 className="text-xl font-bold tracking-wider text-[#07A498]">RIVERZ</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-hidden hover:overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
        {navigationGroups.map((group) => (
          <div key={group.title} className="mb-3">
            <h3 className="mb-1 px-2 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
              {group.title}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                // Fix: More specific active state check to avoid double selection
                const isActive = pathname === item.href || 
                  (item.href !== '/crear' && pathname.startsWith(item.href + '/'));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 text-[12px] font-medium transition-all rounded-lg',
                      isActive
                        ? 'bg-[#07A498]/10 text-[#07A498]'
                        : 'text-gray-400 hover:text-white hover:bg-gray-900'
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

      {/* Bottom Actions */}
      <div className="border-t border-gray-900 px-3 py-2 space-y-0.5">
        <Link
          href="/configuracion"
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 text-[12px] font-medium text-gray-400 transition-all rounded-lg hover:text-white hover:bg-gray-900',
            pathname === '/configuracion' && 'bg-[#07A498]/10 text-[#07A498]'
          )}
        >
          <Settings className="h-3 w-3 shrink-0" />
          <span>Configuración</span>
        </Link>
        
        <button
          onClick={() => signOut(() => window.location.href = '/')}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-[12px] font-medium text-gray-400 transition-all rounded-lg hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="h-3 w-3 shrink-0" />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      {/* User Profile */}
      <div className="border-t border-gray-900 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="scale-90 origin-left">
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

