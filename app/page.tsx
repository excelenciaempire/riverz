'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-800 border-t-brand-accent"></div>
        <p className="mt-4 text-gray-400">Redirigiendo...</p>
      </div>
    </div>
  );
}
