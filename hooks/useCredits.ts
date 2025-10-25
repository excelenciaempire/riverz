'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@clerk/nextjs';

export function useCredits() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: credits, isLoading } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('credits')
        .eq('clerk_id', user!.id)
        .single();

      if (error) throw error;
      return data?.credits || 0;
    },
    enabled: !!user,
  });

  // Real-time subscription to credits changes
  useQuery({
    queryKey: ['credits-subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const channel = supabase
        .channel('credits-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `clerk_id=eq.${user.id}`,
          },
          (payload) => {
            queryClient.setQueryData(['credits', user.id], payload.new.credits);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
    enabled: !!user,
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
      queryClient.invalidateQueries({ queryKey: ['credits', user?.id] });
    },
  });

  return {
    credits: credits || 0,
    isLoading,
    deductCredits: deductCredits.mutate,
  };
}

