/**
 * Security utilities for the Riverz platform
 * Provides rate limiting, input validation, and security checks
 */

import { headers } from 'next/headers';

// Rate limiting store (in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple rate limiter
 * @param identifier - Unique identifier (userId, IP, etc.)
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 */
export async function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): Promise<{ success: boolean; remaining: number }> {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired records
  if (record && record.resetAt < now) {
    rateLimitStore.delete(identifier);
  }

  const current = rateLimitStore.get(identifier);

  if (!current) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return { success: false, remaining: 0 };
  }

  current.count++;
  return { success: true, remaining: limit - current.count };
}

/**
 * Get client IP address
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 10000); // Max length
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Check if user has permission to access resource
 */
export function checkResourceOwnership(
  resourceUserId: string,
  currentUserId: string
): boolean {
  return resourceUserId === currentUserId;
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const randomValues = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      token += chars[randomValues[i] % chars.length];
    }
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return token;
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSizeMB: number
): { valid: boolean; error?: string } {
  // Check file type
  const fileType = file.type.toLowerCase();
  const isAllowedType = allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return fileType.startsWith(type.replace('/*', '/'));
    }
    return fileType === type;
  });

  if (!isAllowedType) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido. Permitidos: ${allowedTypes.join(', ')}`,
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Archivo muy grande. Máximo: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Security headers for API responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  userId: string,
  details: Record<string, any>
): void {
  console.log('[SECURITY]', {
    timestamp: new Date().toISOString(),
    event,
    userId,
    ...details,
  });
  
  // En producción, enviar a un servicio de logging como Sentry, LogRocket, etc.
}

/**
 * Validate generation request
 */
export function validateGenerationRequest(data: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar que no haya scripts maliciosos en prompts
  if (data.prompt) {
    const sanitized = sanitizeInput(data.prompt);
    if (sanitized.length === 0 && data.prompt.length > 0) {
      errors.push('Prompt contiene caracteres no permitidos');
    }
  }

  // Validar que no se intenten inyecciones SQL
  const sqlPatterns = [
    /(\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b).*\b(TABLE|FROM|INTO)\b/i,
    /\bUNION\b.*\bSELECT\b/i,
    /--/,
    /\/\*/,
  ];

  const checkSqlInjection = (value: string) => {
    return sqlPatterns.some(pattern => pattern.test(value));
  };

  if (data.prompt && checkSqlInjection(data.prompt)) {
    errors.push('Entrada sospechosa detectada');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Generaciones - más restrictivo
  generation: {
    limit: 10,
    windowMs: 60000, // 10 por minuto
  },
  // APIs de admin - moderado
  admin: {
    limit: 100,
    windowMs: 60000, // 100 por minuto
  },
  // APIs públicas - más permisivo
  public: {
    limit: 200,
    windowMs: 60000, // 200 por minuto
  },
  // Login attempts - muy restrictivo
  auth: {
    limit: 5,
    windowMs: 300000, // 5 por 5 minutos
  },
};

