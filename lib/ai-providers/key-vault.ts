import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getMasterKey(): Buffer {
  const raw = process.env.GEMINI_KEY_ENCRYPTION_KEY;
  if (!raw) throw new Error('GEMINI_KEY_ENCRYPTION_KEY env var is not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('GEMINI_KEY_ENCRYPTION_KEY must decode to 32 bytes (AES-256). Generate with `openssl rand -base64 32`.');
  }
  return buf;
}

export function encryptApiKey(plain: string): Buffer {
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptApiKey(blob: Buffer | Uint8Array | string): string {
  const buf = Buffer.isBuffer(blob)
    ? blob
    : typeof blob === 'string'
      ? Buffer.from(blob, 'base64')
      : Buffer.from(blob);
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Encrypted payload too short to be a valid AES-GCM blob');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getMasterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function last4(plain: string): string {
  return plain.length <= 4 ? plain : plain.slice(-4);
}
