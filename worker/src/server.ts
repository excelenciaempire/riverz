import { config } from './config.js';
import { claimJobs, markJobFailedOrRetry, markJobSucceeded } from './lib/jobs.js';
import { StealerJob } from './lib/types.js';
import {
  handleExtractAudio,
  handleDetectScenes,
  handleExtractKeyframes,
} from './dispatchers/ffmpeg.js';
import { handleTranscribe } from './dispatchers/transcribe.js';

const dispatchers: Record<string, (job: StealerJob) => Promise<any>> = {
  extract_audio: handleExtractAudio,
  detect_scenes: handleDetectScenes,
  extract_keyframes: handleExtractKeyframes,
  transcribe: handleTranscribe,
  // Future kinds (Phase 2+): generate_actor, generate_broll, tts_master, split_audio,
  // lipsync, trim_to_duration, generate_prompts.
};

async function processJob(job: StealerJob) {
  const handler = dispatchers[job.kind];
  if (!handler) {
    throw new Error(`No dispatcher registered for kind="${job.kind}"`);
  }

  console.log(`[worker] ▶ ${job.kind} ${job.id} (project=${job.project_id?.slice(0, 8) || '-'})`);
  const started = Date.now();

  try {
    const result = await handler(job);
    await markJobSucceeded(job.id, result);
    console.log(`[worker] ✓ ${job.kind} ${job.id} (${Date.now() - started}ms)`);
  } catch (err: any) {
    await markJobFailedOrRetry(job, err);
    console.error(`[worker] ✗ ${job.kind} ${job.id}: ${err.message}`);
  }
}

async function tick() {
  let jobs: StealerJob[] = [];
  try {
    jobs = await claimJobs(config.worker.batchSize);
  } catch (err: any) {
    console.error('[worker] claimJobs failed:', err.message);
    return;
  }
  if (jobs.length === 0) return;

  console.log(`[worker] picked up ${jobs.length} job(s)`);
  // Run claimed jobs in parallel — the DB row-level lock prevents double-pickup.
  await Promise.allSettled(jobs.map((j) => processJob(j)));
}

async function main() {
  console.log(`[worker] starting (id=${config.worker.workerId}, poll=${config.worker.pollIntervalMs}ms, batch=${config.worker.batchSize})`);

  let running = true;
  const stop = (signal: string) => {
    console.log(`[worker] received ${signal}, draining...`);
    running = false;
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  while (running) {
    try {
      await tick();
    } catch (err: any) {
      console.error('[worker] tick crashed:', err.message);
    }
    if (!running) break;
    await new Promise((r) => setTimeout(r, config.worker.pollIntervalMs));
  }

  console.log('[worker] exited cleanly');
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
