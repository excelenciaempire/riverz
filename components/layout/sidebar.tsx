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
  { name: 'Inspiración', href: '/inspiracion', icon: Sparkles },
  { name: 'Crear', href: '/crear', icon: Sparkles },
  { name: 'Editor', href: '/editor', icon: FileEdit },
  { name: 'Marcas', href: '/marcas', icon: Package },
  { name: 'Historial', href: '/historial', icon: History },
  { name: 'Configuración', href: '/configuracion', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { credits } = useCredits();

  return (
    <div className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-brand-dark-secondary">
      {/* Logo */}
      <div className="flex h-20 items-center px-6">
        <h1 className="text-3xl font-bold text-brand-accent">RIVERZ</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                'relative',
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent" />
              )}
            </Link>
          );
        })}

        {/* Logout */}
        <button
          onClick={() => {
            // This will be handled by Clerk
            window.location.href = '/api/auth/signout';
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-gray-400 transition-colors hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </button>
      </nav>

      {/* Credits Display */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Créditos</p>
            <p className="text-lg font-semibold text-white">{credits}</p>
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </div>
  );
}

