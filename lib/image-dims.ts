/**
 * Inline image-dimension detector for PNG / JPEG / WebP. Avoids pulling in
 * `image-size` for a 30-line job and runs on the same buffer we already have
 * in memory after fetching the template thumbnail.
 *
 * Only supported formats matter for this codebase — every template thumbnail
 * is uploaded through Supabase Storage which normalises to PNG/JPEG/WebP.
 * Unknown formats throw so the caller can decide whether to fall back to a
 * default ratio.
 */

export interface ImageDims {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp';
}

export function getImageDimensions(buf: Buffer): ImageDims {
  // PNG: signature 89 50 4E 47 0D 0A 1A 0A, then IHDR with width/height as
  // big-endian uint32 at offsets 16/20.
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      format: 'png',
    };
  }

  // JPEG: SOI = FF D8. Walk segments until we hit a Start-of-Frame
  // (FFC0..FFC3 / FFC5..FFC7 / FFC9..FFCB / FFCD..FFCF). Width/height are
  // 16-bit big-endian at offsets 5/3 inside the SOF segment payload.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      // Skip 0xFF padding bytes between markers.
      while (i < buf.length && buf[i] !== 0xff) i++;
      while (i < buf.length && buf[i] === 0xff) i++;
      const marker = buf[i];
      i++;
      if (marker === undefined) break;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      const segLen = buf.readUInt16BE(i);
      if (isSof) {
        return {
          height: buf.readUInt16BE(i + 3),
          width: buf.readUInt16BE(i + 5),
          format: 'jpeg',
        };
      }
      i += segLen;
    }
    throw new Error('JPEG without SOF segment');
  }

  // WebP: RIFF....WEBPVP8(L|X|space). Three subforms (lossy/lossless/extended).
  if (
    buf.length >= 30 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const fourcc = buf.toString('ascii', 12, 16);
    if (fourcc === 'VP8 ') {
      // Lossy. Width/height are 14-bit at offset 26/28, masked.
      return {
        width: buf.readUInt16LE(26) & 0x3fff,
        height: buf.readUInt16LE(28) & 0x3fff,
        format: 'webp',
      };
    }
    if (fourcc === 'VP8L') {
      // Lossless. Bits packed at offset 21.
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
        format: 'webp',
      };
    }
    if (fourcc === 'VP8X') {
      // Extended. Width/height are 24-bit little-endian at offset 24/27.
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
        format: 'webp',
      };
    }
  }

  throw new Error('Unsupported image format (expected PNG/JPEG/WebP)');
}

// kie.ai Nano Banana Pro supported aspect ratios.
export type NanoBananaAspect =
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4'
  | '9:16' | '16:9' | '21:9';

const SUPPORTED_RATIOS: Array<{ label: NanoBananaAspect; value: number }> = [
  { label: '1:1', value: 1 / 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '5:4', value: 5 / 4 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
];

/**
 * Maps width × height to the closest Nano Banana Pro aspect ratio. Used so the
 * generated ad matches the template's framing instead of being hard-coded to
 * a single ratio (which is what was producing portrait outputs even when the
 * user picked a square or landscape template).
 */
export function pickClosestNanoBananaAspect(width: number, height: number): NanoBananaAspect {
  if (width <= 0 || height <= 0) return '3:4';
  const ratio = width / height;
  let best = SUPPORTED_RATIOS[0];
  let bestDelta = Math.abs(Math.log(ratio / best.value));
  for (const cand of SUPPORTED_RATIOS) {
    const delta = Math.abs(Math.log(ratio / cand.value));
    if (delta < bestDelta) {
      best = cand;
      bestDelta = delta;
    }
  }
  return best.label;
}
