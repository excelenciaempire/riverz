'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';

export function useCredits() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: creditsData, isLoading, refetch } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/credits/balance');
      
      if (!response.ok) {
        throw new Error('Failed to fetch credits');
      }
      
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time Kie.ai balance
    staleTime: 3000, // Consider data stale after 3 seconds
  });

  const deductCredits = useMutation({
    mutationFn: async (amount: number) => {
      const response = await fetch('/api/credits/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) throw new Error('Failed to deduct credits');
      return response.json();
    },
    onSuccess: () => {
      // Immediately refetch credits after deduction
      queryClient.invalidateQueries({ queryKey: ['credits', user?.id] });
    },
  });

  return {
    credits: creditsData?.credits || 0,
    lastUpdated: creditsData?.lastUpdated,
    isLoading,
    deductCredits: deductCredits.mutate,
    refetchCredits: refetch,
  };
}

