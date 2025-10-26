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
    <div className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-black">
      {/* Logo */}
      <div className="flex h-24 items-center justify-center border-b border-gray-800">
        <h1 className="text-4xl font-bold text-brand-accent">RIVERZ</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-6 py-8">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'block py-3 text-base font-normal transition-colors relative',
                isActive
                  ? 'text-white border-b-2 border-brand-accent'
                  : 'text-gray-300 hover:text-white'
              )}
            >
              {item.name}
            </Link>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Logout */}
        <button
          onClick={() => {
            window.location.href = '/api/auth/signout';
          }}
          className="block py-3 text-base font-normal text-gray-300 transition-colors hover:text-white"
        >
          Cerrar Sesión
        </button>
      </nav>

      {/* User Profile */}
      <div className="border-t border-gray-800 p-6">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </div>
  );
}

