# STEALER Worker

Node service that drives the heavy steps of the STEALER engine (AI Video Cloner). Pulls jobs from the `stealer_jobs` table in Supabase, executes ffmpeg / Whisper / kie.ai / ElevenLabs work, and writes results back.

This worker lives in the same git repo as the Next.js app but is deployed separately. The Next.js side stays on Vercel; the worker runs on Render / Railway / Fly because it needs a long-lived process and ffmpeg installed.

## Quick start (local)

1. `cp .env.example .env` and fill in the values (Supabase service role, kie.ai key, OpenAI key).
2. Run the SQL migration once: `riverz/lib/supabase/stealer-migration.sql` in the Supabase SQL editor.
3. From `riverz/worker/`:
   ```
   npm install
   npm run dev
   ```
   The loop logs `[worker] polling for jobs ...` every `WORKER_POLL_INTERVAL_MS` ms.

## Job kinds (Phase 0)

| `kind`              | What it does                                                          |
|---------------------|-----------------------------------------------------------------------|
| `extract_audio`     | ffmpeg: pull the source MP4 from Storage, write 16-kHz mono WAV back. |
| `detect_scenes`     | ffmpeg `select=gt(scene,0.3)` → populate `stealer_scenes`.            |
| `extract_keyframes` | One frame per scene midpoint → upload as `keyframe` asset.            |
| `transcribe`        | OpenAI Whisper API on the extracted audio → save to `transcript`.     |

Other job kinds (`generate_actor`, `generate_broll`, `tts_master`, `lipsync`, `trim_to_duration`) ship in later phases — see [/plans/analiza-esto-y-propon-golden-sphinx.md](../../../.claude/plans/analiza-esto-y-propon-golden-sphinx.md).

## Deployment

### Render
- New Background Worker → connect this repo → set root directory to `worker/`.
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Add the env vars from `.env.example`.
- Add a persistent disk mounted at `/tmp/stealer` if you want to avoid re-downloading source videos between job kinds.

### Railway / Fly
Use the included `Dockerfile`. Both platforms detect it automatically.

## Operational notes

- The worker uses Postgres' `SELECT ... FOR UPDATE SKIP LOCKED` pattern so multiple replicas can run safely.
- Failed jobs back off exponentially: `next_attempt_at = now() + min(60s × 2^attempts, 1h)`. After 5 attempts a job is marked `failed`.
- Scratch files go in `STEALER_TMP_DIR` (default `/tmp/stealer`). Cleared after each job.
- The worker NEVER deducts credits — that happens in Next.js. The worker only reads/writes job state and uploads assets.
