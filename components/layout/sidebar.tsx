'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  Sparkles,
  FileEdit,
  Package,
  History,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';

const navigation = [
  { name: 'Crear', href: '/crear', icon: Sparkles },
  { name: 'Marcas', href: '/marcas', icon: Package },
  { name: 'Editor', href: '/editor', icon: FileEdit, badge: 'pronto' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { credits } = useCredits();

  return (
    <div className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-black border-r border-gray-900">
      {/* Logo */}
      <div className="flex h-20 items-center justify-center">
        <h1 className="text-3xl font-bold tracking-wider text-brand-accent">RIVERZ</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-8 py-6">
        <div className="space-y-1 mb-6">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center justify-between py-2.5 text-[15px] font-normal transition-colors relative',
                  isActive
                    ? 'text-white border-b-2 border-brand-accent pb-2'
                    : 'text-gray-400 hover:text-gray-200',
                  item.badge && 'pointer-events-none'
                )}
              >
                <span>{item.name}</span>
                {item.badge && (
                  <span className="text-xs text-gray-500">({item.badge})</span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          <Link
            href="/historial"
            className={cn(
              'block py-2.5 text-[15px] font-normal transition-colors relative',
              pathname === '/historial' || pathname.startsWith('/historial/')
                ? 'text-white border-b-2 border-brand-accent pb-2'
                : 'text-gray-400 hover:text-gray-200'
            )}
          >
            Historial
          </Link>
          <Link
            href="/configuracion"
            className={cn(
              'block py-2.5 text-[15px] font-normal transition-colors relative',
              pathname === '/configuracion' || pathname.startsWith('/configuracion/')
                ? 'text-white border-b-2 border-brand-accent pb-2'
                : 'text-gray-400 hover:text-gray-200'
            )}
          >
            Configuración
          </Link>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="space-y-1 px-8 pb-6">
        <button
          onClick={() => {
            window.location.href = '/api/auth/signout';
          }}
          className="block py-2.5 text-[15px] font-normal text-gray-400 transition-colors hover:text-gray-200"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* User Profile */}
      <div className="border-t border-gray-900 p-4">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </div>
  );
}

