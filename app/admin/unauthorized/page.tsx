'use client';

import { SignOutButton } from '@clerk/nextjs';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-800 bg-[#141414] p-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-500/10 p-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-white">Acceso No Autorizado</h1>
          <p className="mt-4 text-gray-400">
            Tu cuenta no tiene permisos para acceder al panel de administración.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Contacta al administrador si crees que esto es un error.
          </p>
        </div>

        <SignOutButton>
          <Button className="w-full bg-brand-accent hover:bg-brand-accent/90">
            Cerrar Sesión
          </Button>
        </SignOutButton>
      </div>
    </div>
  );
}

