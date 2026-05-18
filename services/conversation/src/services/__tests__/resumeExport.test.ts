import { generateResumePdfBuffer } from '../resumeExport';

describe('resumeExport', () => {
  it('generates PDF with embedded Unicode font for Cyrillic resume text', async () => {
    const buffer = await generateResumePdfBuffer(
      '# Иван Петров\n\n**Senior Product Manager** | ТехСофт\n\n- Управление продуктом'
    );

    expect(buffer.length).toBeGreaterThan(4000);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    // Embedded DejaVu font is a reliable signal that Cyrillic won't render as mojibake.
    expect(buffer.toString('latin1')).toContain('DejaVuSans');
  });
});
