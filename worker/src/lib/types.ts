export type JobKind =
  | 'extract_audio'
  | 'transcribe'
  | 'detect_scenes'
  | 'extract_keyframes'
  | 'generate_prompts'
  | 'tts_master'
  | 'split_audio'
  | 'generate_actor'
  | 'generate_broll'
  | 'lipsync'
  | 'trim_to_duration';

export type JobStatus = 'pending' | 'running' | 'waiting_callback' | 'succeeded' | 'failed';

export interface StealerJob {
  id: string;
  project_id: string | null;
  scene_id: string | null;
  kind: JobKind;
  payload: Record<string, any> | null;
  status: JobStatus;
  external_task_id: string | null;
  attempts: number;
  next_attempt_at: string;
  result: Record<string, any> | null;
  error_message: string | null;
  worker_id: string | null;
  picked_up_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StealerProject {
  id: string;
  clerk_user_id: string;
  name: string | null;
  source_url: string | null;
  source_video_path: string | null;
  source_duration_sec: number | null;
  source_audio_path: string | null;
  transcript: any | null;
  master_audio_path: string | null;
  master_audio_duration_sec: number | null;
  selected_avatar_id: string | null;
  selected_voice_id: string | null;
  status: string;
  total_credits: number | null;
  error_message: string | null;
}

export type SceneType = 'actor' | 'broll';

export interface StealerScene {
  id: string;
  project_id: string;
  scene_index: number;
  start_sec: number;
  end_sec: number;
  type: SceneType;
  visual_prompt: string | null;
  emotion_context: string | null;
  fallback_prompt: string | null;
  keyframe_path: string | null;
  audio_segment_path: string | null;
  audio_text: string | null;
  status: string;
}
