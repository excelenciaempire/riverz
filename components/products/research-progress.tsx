'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle, Eye, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ResearchStatus = null | 'pending' | 'processing' | 'completed' | 'failed';

interface ResearchProgressProps {
  productId: string;
  initialStatus: ResearchStatus;
  hasResearch: boolean;
  onStartResearch: () => void;
  onViewResearch: () => void;
  isStarting?: boolean;
}

export function ResearchProgress({
  productId,
  initialStatus,
  hasResearch,
  onStartResearch,
  onViewResearch,
  isStarting = false
}: ResearchProgressProps) {
  const [status, setStatus] = useState<ResearchStatus>(initialStatus);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for status updates when processing
  useEffect(() => {
    if (status !== 'processing' && !isStarting) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/research?productId=${productId}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          
          // Stop polling if completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            setIsPolling(false);
          }
        }
      } catch (error) {
        console.error('Error polling research status:', error);
      }
    };

    // Initial poll
    pollStatus();
    
    // Poll every 3 seconds
    const interval = setInterval(pollStatus, 3000);
    
    return () => clearInterval(interval);
  }, [productId, status, isStarting]);

  // Update status when isStarting changes
  useEffect(() => {
    if (isStarting) {
      setStatus('processing');
    }
  }, [isStarting]);

  // Completed state - show "Ver Research" button
  if (status === 'completed' || (hasResearch && status !== 'processing')) {
    return (
      <Button 
        onClick={onViewResearch}
        className="w-full bg-green-600 hover:bg-green-700 text-[var(--rvz-ink)]"
      >
        <Eye className="mr-2 h-5 w-5" />
        Ver Research
      </Button>
    );
  }

  // Processing state - show progress animation
  if (status === 'processing' || isStarting) {
    return (
      <div className="w-full space-y-3">
        <div className="relative overflow-hidden rounded-lg bg-[var(--rvz-accent)]/20 p-4">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-accent/20 to-transparent animate-shimmer" />
          
          <div className="relative flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--rvz-ink)]" />
            <span className="font-medium text-[var(--rvz-ink)]">Analizando mercado...</span>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--rvz-card)]">
            <div className="h-full w-full animate-progress bg-gradient-to-r from-brand-accent via-brand-accent/50 to-brand-accent rounded-full" />
          </div>
          
          <p className="mt-2 text-center text-xs text-[var(--rvz-ink-muted)]">
            Esto puede tomar hasta 60 segundos
          </p>
        </div>
      </div>
    );
  }

  // Failed state
  if (status === 'failed') {
    return (
      <div className="w-full space-y-3">
        <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">El research falló</span>
        </div>
        <Button 
          onClick={onStartResearch}
          disabled={isStarting}
          className="w-full bg-[var(--rvz-accent)] hover:bg-[var(--rvz-accent)]/90"
        >
          <Sparkles className="mr-2 h-5 w-5" />
          Reintentar Research
        </Button>
      </div>
    );
  }

  // Default state - show "Empezar Research" button
  return (
    <Button 
      onClick={onStartResearch}
      disabled={isStarting}
      className="w-full bg-[var(--rvz-accent)] hover:bg-[var(--rvz-accent)]/90"
    >
      {isStarting ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Iniciando...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-5 w-5" />
          Empezar Deep Research
        </>
      )}
    </Button>
  );
}
