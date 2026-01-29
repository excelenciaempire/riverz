import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface GenerationUpdate {
  id: string;
  status: string;
  result_url?: string;
  error_message?: string;
  updated_at: string;
}

export interface ProgressState {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  percentage: number;
  isComplete: boolean;
  completedImages: string[];
}

/**
 * Creates a Supabase Realtime subscription for generation updates
 * 
 * @param projectId - The project to subscribe to
 * @param onUpdate - Callback when a generation is updated
 * @param onProgress - Callback with current progress state
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToGenerations(
  projectId: string,
  onUpdate: (generation: GenerationUpdate) => void,
  onProgress: (progress: ProgressState) => void
): () => void {
  const supabase = createClientComponentClient();
  
  let channel: RealtimeChannel | null = null;
  let generations = new Map<string, { status: string; result_url?: string }>();

  // Initial fetch to get current state
  const fetchInitial = async () => {
    const { data } = await supabase
      .from('generations')
      .select('id, status, result_url, error_message')
      .eq('project_id', projectId);

    if (data) {
      generations.clear();
      data.forEach((gen: any) => {
        generations.set(gen.id, { status: gen.status, result_url: gen.result_url });
      });
      updateProgress();
    }
  };

  // Calculate progress from local state
  const updateProgress = () => {
    let completed = 0;
    let failed = 0;
    const completedImages: string[] = [];

    generations.forEach((gen, id) => {
      if (gen.status === 'completed') {
        completed++;
        if (gen.result_url) {
          completedImages.push(gen.result_url);
        }
      } else if (gen.status === 'failed') {
        failed++;
      }
    });

    const total = generations.size;
    const inProgress = total - completed - failed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    onProgress({
      total,
      completed,
      failed,
      inProgress,
      percentage,
      isComplete: inProgress === 0 && total > 0,
      completedImages
    });
  };

  // Subscribe to realtime updates
  const subscribe = () => {
    channel = supabase
      .channel(`generations-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generations',
          filter: `project_id=eq.${projectId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const newRecord = payload.new;
          
          if (newRecord && newRecord.id) {
            // Update local state
            generations.set(newRecord.id, {
              status: newRecord.status,
              result_url: newRecord.result_url
            });

            // Notify about the specific update
            onUpdate({
              id: newRecord.id,
              status: newRecord.status,
              result_url: newRecord.result_url,
              error_message: newRecord.error_message,
              updated_at: newRecord.updated_at
            });

            // Update overall progress
            updateProgress();
          }
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME] Subscription status for ${projectId}:`, status);
      });
  };

  // Initialize
  fetchInitial().then(() => {
    subscribe();
  });

  // Return cleanup function
  return () => {
    if (channel) {
      console.log(`[REALTIME] Unsubscribing from ${projectId}`);
      supabase.removeChannel(channel);
    }
  };
}

/**
 * Hook-friendly version that can be used with useEffect
 */
export function createGenerationSubscription(projectId: string) {
  return {
    subscribe: (
      onUpdate: (generation: GenerationUpdate) => void,
      onProgress: (progress: ProgressState) => void
    ) => subscribeToGenerations(projectId, onUpdate, onProgress)
  };
}
