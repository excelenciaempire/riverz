'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { ThemeProvider, useTheme } from '@/components/theme/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <ThemedShell>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemedShell>
    </ThemeProvider>
  );
}

/**
 * Wraps Clerk + Sonner so they pick up the active theme. Both ship their
 * own design tokens, so we feed them yellow accent + the right surface
 * colors per theme.
 */
function ThemedShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#0a0a0a',
          colorBackground: isDark ? '#0a0a0a' : '#fafaf7',
          colorText: isDark ? '#fafaf7' : '#0a0a0a',
          colorInputBackground: isDark ? '#15151a' : '#ffffff',
          colorInputText: isDark ? '#fafaf7' : '#0a0a0a',
          fontFamily: 'var(--font-inter-tight), -apple-system, sans-serif',
          borderRadius: '10px',
        },
        elements: {
          card: isDark
            ? 'bg-[#15151a] border border-[#25252e] shadow-none'
            : 'bg-white border border-[#eee5d6] shadow-none',
          formButtonPrimary:
            'bg-[#f7ff9e] hover:bg-[#f1fa84] text-black uppercase tracking-[0.04em] text-[12px] font-bold rounded-md',
          headerTitle: 'font-medium tracking-tight text-[24px]',
          headerSubtitle: isDark ? 'text-white/65' : 'text-black/55',
        },
      }}
    >
      {children}
      <Toaster
        theme={isDark ? 'dark' : 'light'}
        position="top-right"
        toastOptions={{
          style: {
            background: isDark ? '#15151a' : '#ffffff',
            color: isDark ? '#fafaf7' : '#0a0a0a',
            border: isDark ? '1px solid #25252e' : '1px solid #eee5d6',
            fontFamily: 'var(--font-inter-tight), sans-serif',
          },
        }}
      />
    </ClerkProvider>
  );
}

