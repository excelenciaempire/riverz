// User Types
export interface User {
  id: string;
  clerk_id: string;
  email: string;
  credits: number;
  plan_type: 'free' | 'basic' | 'pro' | 'premium';
  language: 'es' | 'en';
  created_at: string;
  updated_at: string;
}

// Product Types
export interface Product {
  id: string;
  user_id: string;
  name: string;
  price: number;
  website: string;
  benefits: string;
  images: string[];
  created_at: string;
  updated_at: string;
}

// Template Types
export interface Template {
  id: string;
  name: string;
  thumbnail_url: string;
  canva_url: string;
  category: string;
  awareness_level: string;
  niche: string;
  view_count: number;
  edit_count: number;
  created_at: string;
}

// Generation Types
export type GenerationType = 
  | 'ugc'
  | 'face_swap'
  | 'clips'
  | 'editar_foto_crear'
  | 'editar_foto_editar'
  | 'editar_foto_combinar'
  | 'editar_foto_clonar'
  | 'mejorar_calidad_video'
  | 'mejorar_calidad_imagen';

export interface Generation {
  id: string;
  user_id: string;
  type: GenerationType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input_data: Record<string, any>;
  result_url?: string;
  cost: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// API Log Types
export interface APILog {
  id: string;
  user_id?: string;
  endpoint: string;
  method: string;
  status_code: number;
  request_body?: Record<string, any>;
  response_body?: Record<string, any>;
  error_message?: string;
  created_at: string;
}

// Subscription Plans
export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    credits: 0,
    features: ['1 producto en Marcas', 'Ver plantillas', 'Editar 3 plantillas'],
  },
  basic: {
    name: 'Basic',
    price: 19,
    credits: 2000,
    features: ['Todas las características', '2000 créditos'],
    priceId: 'price_1SMa3nL0pSUS73AdPYCERky4',
  },
  pro: {
    name: 'Pro',
    price: 49,
    credits: 5500,
    features: ['Todas las características', '5500 créditos'],
    priceId: 'price_1SMa4XL0pSUS73Ad6UmNSAjm',
  },
  premium: {
    name: 'Premium',
    price: 99,
    credits: 12000,
    features: ['Todas las características', '12000 créditos'],
    priceId: 'price_1SMa5EL0pSUS73Ad8SJHsCBB',
  },
} as const;

// N8N Webhook Response
export interface N8NWebhookResponse {
  success: boolean;
  job_id?: string;
  result_url?: string;
  error?: string;
}

// Form Types
export interface UGCFormData {
  avatar_type: 'library' | 'upload' | 'generate';
  avatar_id?: string;
  avatar_file?: File;
  avatar_prompt?: string;
  script: string;
  voice_id: string;
  product_id?: string;
}

export interface FaceSwapFormData {
  source_video: File;
  character_image: File;
  resolution: string;
  format: string;
}

export interface ClipsFormData {
  image?: File;
  prompt: string;
  model: string;
  format: string;
  duration: string;
}

export interface EditarFotoCrearFormData {
  prompt: string;
  format: string;
}

export interface EditarFotoEditarFormData {
  image: File;
  edited_image: Blob;
  prompt: string;
}

export interface EditarFotoCombinarFormData {
  images: File[];
  prompt: string;
  format: string;
}

export interface EditarFotoClonarFormData {
  reference_image: File;
  product_image: File;
  prompt: string;
  format: string;
  num_variants: number;
}

export interface MejorarCalidadVideoFormData {
  video: File;
  upscale_factor: number;
  target_fps: number;
  h264_output: boolean;
}

export interface MejorarCalidadImagenFormData {
  image: File;
}

