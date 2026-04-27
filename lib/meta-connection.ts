import { decrypt } from '@/lib/crypto';

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export interface StoredConnection {
  status: string;
  token_expires_at: string | null;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_tag: string;
  last_error: string | null;
}

export type ConnectionResult =
  | { ok: true; token: string }
  | { ok: false; status: 401 | 500; requiresReconnect?: boolean; error: string; markExpired?: boolean };

export function resolveConnection(connection: StoredConnection | null): ConnectionResult {
  if (!connection) {
    return { ok: false, status: 401, requiresReconnect: true, error: 'No hay conexión con Meta' };
  }
  if (connection.status !== 'active') {
    return {
      ok: false,
      status: 401,
      requiresReconnect: true,
      error: connection.last_error || 'La conexión con Meta está inactiva',
    };
  }
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < Date.now() + EXPIRY_BUFFER_MS) {
      return {
        ok: false,
        status: 401,
        requiresReconnect: true,
        error: 'token_expired',
        markExpired: true,
      };
    }
  }
  try {
    const token = decrypt({
      ciphertext: connection.access_token_ciphertext,
      iv: connection.access_token_iv,
      tag: connection.access_token_tag,
    });
    return { ok: true, token };
  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      error: `No se pudo descifrar el token de Meta: ${err?.message || 'error'}`,
    };
  }
}
