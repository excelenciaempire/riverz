'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignIn, useUser } from '@clerk/nextjs';

const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];

export default function AdminLoginPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const userEmail = user.emailAddresses[0]?.emailAddress || '';
      const isAdmin = ADMIN_EMAILS.some(email => email.trim().toLowerCase() === userEmail.toLowerCase());
      
      if (isAdmin) {
        router.push('/admin/dashboard');
      } else {
        router.push('/admin/unauthorized');
      }
    }
  }, [isLoaded, isSignedIn, user, router]);

  // Si ya está logueado, mostrar loading mientras redirige
  if (isLoaded && isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-wider text-brand-accent">RIVERZ</h1>
          <p className="mt-4 text-white">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-wider text-brand-accent">RIVERZ</h1>
          <p className="mt-4 text-xl font-semibold text-white">Admin Dashboard</p>
          <p className="mt-2 text-sm text-gray-400">Acceso restringido para administradores</p>
        </div>
        
        <SignIn 
          afterSignInUrl="/admin/dashboard"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-[#141414] border border-gray-800",
            },
          }}
        />
      </div>
    </div>
  );
}
