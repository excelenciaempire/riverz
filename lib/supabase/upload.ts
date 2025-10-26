import { createClient } from './client';
import { STORAGE_BUCKETS, generateFileName, validateFileSize, validateMimeType, getFileSizeErrorMessage } from './storage';

export interface UploadOptions {
  bucket: keyof typeof STORAGE_BUCKETS;
  file: File;
  allowedMimeTypes?: readonly string[];
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Sube un archivo a Supabase Storage
 */
export async function uploadFile({
  bucket,
  file,
  allowedMimeTypes,
  onProgress,
}: UploadOptions): Promise<UploadResult> {
  try {
    const supabase = createClient();
    const bucketName = STORAGE_BUCKETS[bucket];

    // Validar tamaño
    if (!validateFileSize(file, bucket)) {
      return {
        success: false,
        error: getFileSizeErrorMessage(bucket),
      };
    }

    // Validar tipo MIME si se especifica
    if (allowedMimeTypes && !validateMimeType(file, allowedMimeTypes)) {
      return {
        success: false,
        error: 'Tipo de archivo no permitido',
      };
    }

    // Generar nombre único
    const fileName = generateFileName(file.name);

    // Simular progreso si se proporciona callback
    if (onProgress) {
      onProgress(10);
    }

    // Subir archivo
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return {
        success: false,
        error: uploadError.message || 'Error al subir archivo',
      };
    }

    if (onProgress) {
      onProgress(90);
    }

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    if (onProgress) {
      onProgress(100);
    }

    return {
      success: true,
      url: publicUrl,
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message || 'Error inesperado al subir archivo',
    };
  }
}

/**
 * Elimina un archivo de Supabase Storage
 */
export async function deleteFile(bucket: keyof typeof STORAGE_BUCKETS, fileName: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const bucketName = STORAGE_BUCKETS[bucket];

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
}

/**
 * Extrae el nombre del archivo de una URL pública de Supabase
 */
export function extractFileNameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    return pathParts[pathParts.length - 1];
  } catch {
    return null;
  }
}

