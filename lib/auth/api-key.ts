/**
 * API key utilities — generación + verificación de tokens Bearer para
 * los endpoints públicos /api/v1/*.
 *
 * Formato del token visible al usuario:
 *   `rvz_live_<22-char-base32-random>`
 *
 * - Los primeros 12 caracteres (`rvz_live_xxx`) se guardan en `key_prefix`
 *   para mostrarlos en la UI ("rvz_live_xxx••••").
 * - El token completo se hashea con scrypt (built-in de Node) y se guarda
 *   en `key_hash`. El usuario sólo ve el plaintext UNA vez al crearlo.
 *
 * Verificación: para autenticar un request, leemos `key_prefix` (que es
 * único entre keys activas: 12 chars de base32 dan ~10^17 combinaciones)
 * y comparamos el hash. Si no hay índice por prefix, la búsqueda por
 * key_hash sería un O(N); el prefix lookup es O(1).
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';

const PREFIX = 'rvz_live_';
const RANDOM_BYTES = 18; // 18 bytes → 24 char base32 sin padding (lo cortamos a 22)
const SCRYPT_KEYLEN = 32;
const SCRYPT_SALT_BYTES = 16;

export interface IssuedKey {
  /** Token completo `rvz_live_xxx…`. Mostrar UNA vez. */
  token: string;
  /** Primeros 12 chars para guardar y mostrar en UI. */
  prefix: string;
  /** Hash a guardar en `key_hash`. Formato: `s$<salt-hex>$<hash-hex>`. */
  hash: string;
}

export function issueApiKey(): IssuedKey {
  const random = randomBytes(RANDOM_BYTES).toString('base64url').replace(/[_-]/g, '').slice(0, 22);
  const token = `${PREFIX}${random}`;
  const prefix = token.slice(0, 12);
  const hash = hashToken(token);
  return { token, prefix, hash };
}

function hashToken(token: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const hash = scryptSync(token, salt, SCRYPT_KEYLEN);
  return `s$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyToken(token: string, stored: string): boolean {
  if (!stored.startsWith('s$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const target = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(token, salt, target.length);
  return derived.length === target.length && timingSafeEqual(derived, target);
}

export interface AuthenticatedKey {
  id: string;
  clerk_user_id: string;
}

/**
 * Resolve un Bearer token desde un Request → fila de api_keys.
 * Devuelve null si no auth o key revocada.
 */
export async function authenticateApiKey(req: Request): Promise<AuthenticatedKey | null> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token.startsWith(PREFIX)) return null;
  const prefix = token.slice(0, 12);

  const supabase = createAdminClient();
  // Como `key_prefix` no es único globalmente (en teoría 2 keys podrían
  // chocar), buscamos todas las activas con ese prefix y verificamos hash.
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, clerk_user_id, key_hash, revoked_at')
    .eq('key_prefix', prefix);
  if (error || !data) return null;

  for (const row of data) {
    if (row.revoked_at) continue;
    if (verifyToken(token, row.key_hash)) {
      // Best-effort: actualizar last_used_at sin bloquear la respuesta.
      supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', row.id)
        .then(() => null);
      return { id: row.id, clerk_user_id: row.clerk_user_id };
    }
  }
  return null;
}
