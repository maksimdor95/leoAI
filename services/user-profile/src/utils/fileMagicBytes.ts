const PDF_MAGIC = Buffer.from('%PDF-');
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function assertResumeMagicBytes(buffer: Buffer, filename: string): void {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) {
    if (buffer.length < PDF_MAGIC.length || !buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new Error('Файл не является корректным PDF');
    }
    return;
  }
  if (lower.endsWith('.docx')) {
    if (buffer.length < DOCX_MAGIC.length || !buffer.subarray(0, DOCX_MAGIC.length).equals(DOCX_MAGIC)) {
      throw new Error('Файл не является корректным DOCX');
    }
    return;
  }
  throw new Error('Допустимы только файлы .pdf и .docx');
}
