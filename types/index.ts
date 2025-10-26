export interface User {
  id: string;
  clerk_id: string;
  email: string;
  credits: number;
  plan_type: 'free' | 'basic' | 'pro' | 'premium';
  language: 'es' | 'en';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

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

export interface Generation {
  id: string;
  user_id: string;
  type:
    | 'ugc'
    | 'face_swap'
    | 'clips'
    | 'editar_foto_crear'
    | 'editar_foto_editar'
    | 'editar_foto_combinar'
    | 'editar_foto_clonar'
    | 'mejorar_calidad_video'
    | 'mejorar_calidad_imagen';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input_data: any;
  result_url?: string;
  cost: number;
  error_message?: string;
  n8n_job_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  thumbnail_url: string;
  canva_url: string;
  category?: string;
  awareness_level?: string;
  niche?: string;
  view_count: number;
  edit_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface APILog {
  id: string;
  user_id?: string;
  endpoint: string;
  method: string;
  status_code: number;
  request_body?: any;
  response_body?: any;
  error_message?: string;
  created_at: string;
}

export interface Avatar {
  id: string;
  name: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
}

export interface Voice {
  id: string;
  name: string;
  eleven_labs_voice_id: string;
  preview_url?: string;
  language?: string;
  is_active: boolean;
  created_at: string;
}

