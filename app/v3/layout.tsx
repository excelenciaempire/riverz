import type { ReactNode } from 'react';
import { SmoothScrollProvider } from '@/components/landing-v3/shared/SmoothScrollProvider';

export default function V3Layout({ children }: { children: ReactNode }) {
  return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}
