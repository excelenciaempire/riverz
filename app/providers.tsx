'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
      },
    },
  }));

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#07A498',
          colorBackground: '#161616',
          colorText: '#FFFFFF',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: { background: '#101010', color: '#FFFFFF', border: '1px solid #333' },
          }}
        />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

