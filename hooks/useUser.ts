'use client';

import { useUser as useClerkUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@/types';

export function useUser() {
  const { user: clerkUser, isLoaded } = useClerkUser();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['user', clerkUser?.id],
    queryFn: async () => {
      const response = await fetch('/api/user');
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: isLoaded && !!clerkUser,
  });

  return {
    user,
    clerkUser,
    isLoading: !isLoaded || isLoading,
  };
}

