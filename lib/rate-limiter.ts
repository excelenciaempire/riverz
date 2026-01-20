/**
 * Rate Limiter for Kie.ai API
 * Respects 20 requests per 10 seconds limit
 */

import { createClient } from '@/lib/supabase/server';

const RATE_LIMIT = 18; // Stay slightly under 20 for safety
const WINDOW_MS = 10000; // 10 seconds

interface RateLimitState {
  requests: number;
  windowStart: number;
}

// In-memory rate limit tracking (resets on server restart - that's OK)
let rateLimitState: RateLimitState = {
  requests: 0,
  windowStart: Date.now(),
};

/**
 * Check if we can make a request, returns wait time in ms if rate limited
 */
export function checkRateLimit(): { canProceed: boolean; waitMs: number } {
  const now = Date.now();
  
  // Reset window if expired
  if (now - rateLimitState.windowStart >= WINDOW_MS) {
    rateLimitState = {
      requests: 0,
      windowStart: now,
    };
  }
  
  if (rateLimitState.requests < RATE_LIMIT) {
    return { canProceed: true, waitMs: 0 };
  }
  
  // Calculate how long to wait
  const waitMs = WINDOW_MS - (now - rateLimitState.windowStart);
  return { canProceed: false, waitMs: Math.max(0, waitMs) };
}

/**
 * Record a request made to the API
 */
export function recordRequest(): void {
  const now = Date.now();
  
  // Reset window if expired
  if (now - rateLimitState.windowStart >= WINDOW_MS) {
    rateLimitState = {
      requests: 1,
      windowStart: now,
    };
  } else {
    rateLimitState.requests++;
  }
}

/**
 * Wait until rate limit allows a request
 */
export async function waitForRateLimit(): Promise<void> {
  const { canProceed, waitMs } = checkRateLimit();
  
  if (!canProceed && waitMs > 0) {
    console.log(`[RATE_LIMIT] Waiting ${waitMs}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, waitMs + 100)); // Add small buffer
  }
}

/**
 * Execute a function with rate limiting and retry logic
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await waitForRateLimit();
    
    try {
      recordRequest();
      const result = await fn();
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check for rate limit error (429)
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.log(`[RATE_LIMIT] Hit 429, waiting 10s before retry ${attempt + 1}/${maxRetries}`);
        // Reset our window and wait
        rateLimitState = { requests: RATE_LIMIT, windowStart: Date.now() };
        await new Promise(resolve => setTimeout(resolve, WINDOW_MS));
        continue;
      }
      
      // For other errors, don't retry
      throw error;
    }
  }
  
  throw lastError || new Error('Rate limit exceeded after max retries');
}

/**
 * Get batch size recommendation based on current rate limit state
 */
export function getRecommendedBatchSize(): number {
  const { canProceed, waitMs } = checkRateLimit();
  
  if (!canProceed) return 0;
  
  const remainingInWindow = RATE_LIMIT - rateLimitState.requests;
  // Each generation needs 2 API calls (Gemini + Nano Banana)
  return Math.max(1, Math.floor(remainingInWindow / 2));
}

/**
 * Calculate estimated time for bulk generation
 */
export function estimateBulkTime(totalGenerations: number): {
  estimatedMinutes: number;
  batches: number;
} {
  // Each generation = ~2 API calls (analysis + generation)
  const totalRequests = totalGenerations * 2;
  // We can do RATE_LIMIT requests per WINDOW_MS
  const windowsNeeded = Math.ceil(totalRequests / RATE_LIMIT);
  const estimatedMs = windowsNeeded * WINDOW_MS;
  // Add processing time per generation (~5 seconds average)
  const processingTime = totalGenerations * 5000;
  
  return {
    estimatedMinutes: Math.ceil((estimatedMs + processingTime) / 60000),
    batches: Math.ceil(totalGenerations / Math.floor(RATE_LIMIT / 2))
  };
}
