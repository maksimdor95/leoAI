/**
 * Detect image type from magic bytes. Returns extension without dot.
 */
export function detectImageExtension(buffer: Buffer): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (buffer.length < 12) return null;
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }
  // GIF
  if (
    buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
    buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
  ) {
    return 'gif';
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export function assertImageMagicBytes(buffer: Buffer): 'jpg' | 'png' | 'webp' | 'gif' {
  const ext = detectImageExtension(buffer);
  if (!ext) {
    throw new Error('Допустимы только изображения JPEG, PNG, WebP или GIF');
  }
  return ext;
}
