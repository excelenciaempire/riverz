import { config } from '../config.js';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export interface TtsOptions {
  voiceId: string;
  text: string;
  modelId?: string; // 'eleven_multilingual_v2' is solid for ES + EN
  stability?: number;
  similarity?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

/**
 * Calls ElevenLabs text-to-speech and returns the MP3 bytes.
 *
 * Synchronous endpoint: works well for clips under ~5 min. For very long
 * scripts we'd switch to the async /history endpoint with polling, but the
 * STEALER pipeline is targeting ad-length videos (15-60s), so sync is fine.
 */
export async function synthesizeTts(opts: TtsOptions): Promise<Buffer> {
  if (!config.elevenlabs.apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const body = {
    text: opts.text,
    model_id: opts.modelId || 'eleven_multilingual_v2',
    voice_settings: {
      stability: opts.stability ?? 0.5,
      similarity_boost: opts.similarity ?? 0.75,
      style: opts.style ?? 0.3,
      use_speaker_boost: opts.useSpeakerBoost ?? true,
    },
  };

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(opts.voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': config.elevenlabs.apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${txt.slice(0, 500)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
