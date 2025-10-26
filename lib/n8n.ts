import axios from 'axios';
import type { N8NWebhookResponse } from '@/types';

interface N8NRequest {
  endpoint: string;
  data: Record<string, any>;
  userId?: string;
}

export async function triggerN8NWebhook({
  endpoint,
  data,
  userId,
}: N8NRequest): Promise<N8NWebhookResponse> {
  try {
    const response = await axios.post(endpoint, data, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout for initial request
    });

    return response.data;
  } catch (error) {
    console.error('N8N webhook error:', error);
    throw new Error('Failed to trigger N8N webhook');
  }
}

export async function pollN8NResult(
  jobId: string,
  endpoint: string,
  maxAttempts = 60,
  interval = 5000
): Promise<N8NWebhookResponse> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(`${endpoint}/${jobId}`, {
        timeout: 10000,
      });

      const data = response.data;

      if (data.status === 'completed') {
        return data;
      }

      if (data.status === 'failed') {
        throw new Error(data.error || 'Generation failed');
      }

      // Still processing, wait and try again
      await new Promise((resolve) => setTimeout(resolve, interval));
      attempts++;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Job not found yet, continue polling
        await new Promise((resolve) => setTimeout(resolve, interval));
        attempts++;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Polling timeout: Generation took too long');
}

// Specific webhook endpoints
export const N8N_ENDPOINTS = {
  ugc: process.env.N8N_UGC_WEBHOOK_URL || '',
  faceSwap: process.env.N8N_FACE_SWAP_WEBHOOK_URL || '',
  clips: process.env.N8N_CLIPS_WEBHOOK_URL || '',
  editarFotoCrear: process.env.N8N_EDITAR_FOTO_CREAR_WEBHOOK_URL || '',
  editarFotoEditar: process.env.N8N_EDITAR_FOTO_EDITAR_WEBHOOK_URL || '',
  editarFotoCombinar: process.env.N8N_EDITAR_FOTO_COMBINAR_WEBHOOK_URL || '',
  editarFotoClonar: process.env.N8N_EDITAR_FOTO_CLONAR_WEBHOOK_URL || '',
  staticAdsIdeacion: process.env.N8N_STATIC_ADS_IDEACION_WEBHOOK_URL || '',
  mejorarCalidadVideo: process.env.N8N_MEJORAR_CALIDAD_VIDEO_WEBHOOK_URL || '',
  mejorarCalidadImagen: process.env.N8N_MEJORAR_CALIDAD_IMAGEN_WEBHOOK_URL || '',
  marcasReport: process.env.N8N_MARCAS_REPORT_WEBHOOK_URL || '',
};

// Helper to upload files to N8N (if needed)
export async function uploadFileToN8N(file: File, endpoint: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(endpoint, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.url;
}

