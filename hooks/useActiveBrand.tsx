'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import type { Product } from '@/types';

const STORAGE_KEY = 'riverz:active-brand-id';

type ActiveBrandContextValue = {
  activeBrandId: string | null;
  activeBrand: Product | null;
  brands: Product[];
  setActiveBrandId: (id: string | null) => void;
  isLoading: boolean;
};

const ActiveBrandContext = createContext<ActiveBrandContextValue | null>(null);

export function ActiveBrandProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const urlBrandId = searchParams.get('brand');

  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const { data: brands = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/products');
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Hydrate from URL → localStorage → first brand
  useEffect(() => {
    if (hydrated || isLoading) return;

    let next: string | null = null;
    if (urlBrandId && brands.some((b) => b.id === urlBrandId)) {
      next = urlBrandId;
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && brands.some((b) => b.id === saved)) {
          next = saved;
        }
      } catch {
        /* ignore */
      }
      if (!next && brands.length > 0) {
        next = brands[0].id;
      }
    }
    setActiveBrandIdState(next);
    setHydrated(true);
  }, [brands, isLoading, urlBrandId, hydrated]);

  const setActiveBrandId = useCallback((id: string | null) => {
    setActiveBrandIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const activeBrand = useMemo(
    () => brands.find((b) => b.id === activeBrandId) ?? null,
    [brands, activeBrandId],
  );

  const value = useMemo<ActiveBrandContextValue>(
    () => ({
      activeBrandId,
      activeBrand,
      brands,
      setActiveBrandId,
      isLoading: isLoading || !hydrated,
    }),
    [activeBrandId, activeBrand, brands, setActiveBrandId, isLoading, hydrated],
  );

  return <ActiveBrandContext.Provider value={value}>{children}</ActiveBrandContext.Provider>;
}

export function useActiveBrand(): ActiveBrandContextValue {
  const ctx = useContext(ActiveBrandContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider — keeps things safe.
    return {
      activeBrandId: null,
      activeBrand: null,
      brands: [],
      setActiveBrandId: () => {},
      isLoading: false,
    };
  }
  return ctx;
}
