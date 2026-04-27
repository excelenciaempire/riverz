import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    bucket: process.env.STEALER_BUCKET || 'stealer',
  },
  kie: {
    apiKey: process.env.KIE_API_KEY || '',
    baseUrl: process.env.KIE_BASE_URL || 'https://api.kie.ai',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
  },
  worker: {
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 10000),
    batchSize: Number(process.env.WORKER_BATCH_SIZE || 5),
    workerId: process.env.WORKER_ID || `worker-${Math.random().toString(36).slice(2, 8)}`,
    tmpDir: process.env.STEALER_TMP_DIR || '/tmp/stealer',
    maxAttempts: 5,
  },
  webhooks: {
    // Public URL of the Next.js app (e.g. https://riverz.app). When set, the
    // worker passes <publicUrl>/api/webhooks/kie?secret=... as callBackUrl on
    // every Veo task so kie.ai can push completion events. Polling still runs
    // as a safety net.
    publicUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || '',
    secret: process.env.STEALER_WEBHOOK_SECRET || '',
  },
};
