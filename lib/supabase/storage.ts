/**
 * Supabase Storage Configuration
 * 
 * Buckets disponibles:
 * - avatars: Imágenes de avatares para UGC (sin límite)
 * - user-uploads: Uploads temporales de usuarios (50MB max)
 * - products: Imágenes de productos (10MB max)
 * - generations: Resultados finales de generaciones (100MB max)
 */

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  USER_UPLOADS: 'user-uploads',
  PRODUCTS: 'products',
  GENERATIONS: 'generations',
} as const;

export const STORAGE_LIMITS = {
  [STORAGE_BUCKETS.AVATARS]: null, // Sin límite
  [STORAGE_BUCKETS.USER_UPLOADS]: 50 * 1024 * 1024, // 50MB
  [STORAGE_BUCKETS.PRODUCTS]: 10 * 1024 * 1024, // 10MB
  [STORAGE_BUCKETS.GENERATIONS]: 100 * 1024 * 1024, // 100MB
} as const;

export const ALLOWED_MIME_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/webp'],
  VIDEOS: ['video/mp4', 'video/quicktime'],
  ALL_MEDIA: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
} as const;

/**
 * Valida el tamaño de un archivo contra el límite del bucket
 */
export function validateFileSize(file: File, bucket: keyof typeof STORAGE_BUCKETS): boolean {
  const limit = STORAGE_LIMITS[STORAGE_BUCKETS[bucket]];
  if (limit === null) return true;
  return file.size <= limit;
}

/**
 * Valida el tipo MIME de un archivo
 */
export function validateMimeType(file: File, allowedTypes: readonly string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Genera un nombre de archivo único
 */
export function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${random}-${timestamp}.${ext}`;
}

/**
 * Obtiene el mensaje de error apropiado según el límite del bucket
 */
export function getFileSizeErrorMessage(bucket: keyof typeof STORAGE_BUCKETS): string {
  const limit = STORAGE_LIMITS[STORAGE_BUCKETS[bucket]];
  if (limit === null) return 'Archivo demasiado grande';
  const limitMB = Math.round(limit / (1024 * 1024));
  return `El archivo debe ser menor a ${limitMB}MB`;
}

