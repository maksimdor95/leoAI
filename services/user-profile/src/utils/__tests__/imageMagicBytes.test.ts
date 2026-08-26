import { assertImageMagicBytes, detectImageExtension } from '../imageMagicBytes';

describe('imageMagicBytes', () => {
  it('detects jpeg/png/webp/gif', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(12)]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Buffer.alloc(12)]);
    const gif = Buffer.from('GIF89a' + 'x'.repeat(12));
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBP'),
      Buffer.alloc(4),
    ]);

    expect(detectImageExtension(jpeg)).toBe('jpg');
    expect(detectImageExtension(png)).toBe('png');
    expect(detectImageExtension(gif)).toBe('gif');
    expect(detectImageExtension(webp)).toBe('webp');
    expect(assertImageMagicBytes(jpeg)).toBe('jpg');
  });

  it('rejects non-images', () => {
    expect(detectImageExtension(Buffer.from('%PDF-1.4'))).toBeNull();
    expect(() => assertImageMagicBytes(Buffer.from('hello'))).toThrow(/изображения/);
  });
});
