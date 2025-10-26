'use client';

import { SignIn } from '@clerk/nextjs';

export default function AdminLoginPage() {
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
