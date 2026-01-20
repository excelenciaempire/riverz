'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Video,
  Image,
  FileText,
  Settings,
  AlertCircle,
  Package,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Usuarios', href: '/admin/usuarios', icon: Users },
  { name: 'Productos (Prompts)', href: '/admin/dashboard/productos', icon: Package },
  { name: 'Videos', href: '/admin/videos', icon: Video },
  { name: 'Imágenes', href: '/admin/imagenes', icon: Image },
  { name: 'Plantillas', href: '/admin/plantillas', icon: FileText },
  { name: 'API Endpoints', href: '/admin/api-endpoints', icon: Settings },
  { name: 'Logs', href: '/admin/logs', icon: AlertCircle },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-brand-dark-secondary">
      {/* Logo */}
      <div className="flex h-20 items-center px-6">
        <h1 className="text-2xl font-bold text-brand-accent">RIVERZ ADMIN</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-accent text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-700 p-4">
        <p className="text-xs text-gray-500">Riverz Admin v1.0</p>
      </div>
    </div>
  );
}

