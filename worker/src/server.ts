import { config } from './config.js';
import {
  claimJobs,
  claimWaitingCallbacks,
  markJobFailedOrRetry,
  markJobSucceeded,
} from './lib/jobs.js';
import { StealerJob } from './lib/types.js';
import {
  handleExtractAudio,
  handleDetectScenes,
  handleExtractKeyframes,
} from './dispatchers/ffmpeg.js';
import { handleTranscribe } from './dispatchers/transcribe.js';
import { handleGeneratePrompts } from './dispatchers/prompts.js';
import { handleSplitAudio } from './dispatchers/audio-split.js';
import { handleGenerateActor, handleGenerateBroll } from './dispatchers/video.js';
import { handleTrimToDuration } from './dispatchers/trim.js';
import { pollVeoJob } from './dispatchers/poll-veo.js';

const dispatchers: Record<string, (job: StealerJob) => Promise<any>> = {
  // Phase 0
  extract_audio: handleExtractAudio,
  detect_scenes: handleDetectScenes,
  extract_keyframes: handleExtractKeyframes,
  transcribe: handleTranscribe,
  // Phase 2
  generate_prompts: handleGeneratePrompts,
  split_audio: handleSplitAudio,
  generate_actor: handleGenerateActor,
  generate_broll: handleGenerateBroll,
  trim_to_duration: handleTrimToDuration,
  // Phase 4 (TBD): tts_master, lipsync.
};

async function processJob(job: StealerJob) {
  const handler = dispatchers[job.kind];
  if (!handler) {
    await markJobFailedOrRetry(job, new Error(`No dispatcher registered for kind="${job.kind}"`));
    return;
  }

  console.log(`[worker] ▶ ${job.kind} ${job.id} (project=${job.project_id?.slice(0, 8) || '-'})`);
  const started = Date.now();

  try {
    const result = await handler(job);
    // generate_actor / generate_broll handlers DO NOT mark the job succeeded —
    // they flip it to waiting_callback. Everything else gets marked succeeded here.
    if (job.kind !== 'generate_actor' && job.kind !== 'generate_broll') {
      await markJobSucceeded(job.id, result);
    }
    console.log(`[worker] ✓ ${job.kind} ${job.id} (${Date.now() - started}ms)`);
  } catch (err: any) {
    await markJobFailedOrRetry(job, err);
    console.error(`[worker] ✗ ${job.kind} ${job.id}: ${err.message}`);
  }
}

async function pollPendingTasks() {
  // Don't take a huge batch — polling kie.ai for 50+ tasks per tick gets noisy.
  const waiting = await claimWaitingCallbacks(10);
  if (waiting.length === 0) return;
  console.log(`[worker] polling ${waiting.length} waiting_callback job(s)`);

  await Promise.allSettled(
    waiting.map(async (job) => {
      try {
        const r = await pollVeoJob(job);
        if (r.done) console.log(`[worker] callback ${job.id} resolved (${r.reason || 'ok'})`);
      } catch (err: any) {
        console.error(`[worker] poll error on ${job.id}: ${err.message}`);
        // Don't fail the job on transient poll errors — let it stay waiting_callback
        // for the next tick. If kie.ai is permanently broken, claimJobs will eventually
        // re-pickup the original generate_* through the running grace path.
      }
    })
  );
}

async function tick() {
  // Phase 1: poll any tasks waiting on external services.
  try {
    await pollPendingTasks();
  } catch (err: any) {
    console.error('[worker] pollPendingTasks failed:', err.message);
  }

  // Phase 2: claim and process pending jobs.
  let jobs: StealerJob[] = [];
  try {
    jobs = await claimJobs(config.worker.batchSize);
  } catch (err: any) {
    console.error('[worker] claimJobs failed:', err.message);
    return;
  }
  if (jobs.length === 0) return;

  console.log(`[worker] picked up ${jobs.length} job(s)`);
  await Promise.allSettled(jobs.map((j) => processJob(j)));
}

async function main() {
  console.log(
    `[worker] starting (id=${config.worker.workerId}, poll=${config.worker.pollIntervalMs}ms, batch=${config.worker.batchSize})`
  );

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
