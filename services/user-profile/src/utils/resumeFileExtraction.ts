import mammoth from 'mammoth';
import { logger } from './logger';
import { extractTextWithResumeParser } from '../services/resumeParserClient';

const MIN_EXTRACTED_LENGTH = 20;
const QUALITY_THRESHOLD = Number(process.env.RESUME_QUALITY_THRESHOLD || '0.55');

function calcTextQualityScore(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim());
  const nonEmptyLines = lines.filter((line) => line.length > 0);
  const words = trimmed.split(/\s+/).filter(Boolean);

  const printableChars = (trimmed.match(/[ \x21-\x7E\u0400-\u04FF]/g) || []).length;
  const lettersOrDigits = (trimmed.match(/[A-Za-zА-Яа-яЁё0-9]/g) || []).length;
  const weirdTokenCount = words.filter((word) => /^[^\wА-Яа-яЁё]{3,}$/.test(word)).length;
  const avgLineLength =
    nonEmptyLines.length > 0
      ? nonEmptyLines.reduce((sum, line) => sum + line.length, 0) / nonEmptyLines.length
      : 0;

  const printableRatio = printableChars / Math.max(trimmed.length, 1);
  const alphaNumericRatio = lettersOrDigits / Math.max(trimmed.length, 1);
  const weirdRatio = weirdTokenCount / Math.max(words.length, 1);
  const lineLengthScore = Math.min(avgLineLength / 45, 1);
  const lengthScore = Math.min(trimmed.length / 1500, 1);

  const score =
    0.35 * printableRatio +
    0.3 * alphaNumericRatio +
    0.2 * (1 - weirdRatio) +
    0.1 * lineLengthScore +
    0.05 * lengthScore;

  return Math.max(0, Math.min(1, score));
}

function shouldFallbackToPdfplumber(text: string): boolean {
  const score = calcTextQualityScore(text);
  return text.length < MIN_EXTRACTED_LENGTH || score < QUALITY_THRESHOLD;
}

export async function extractResumeTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<string> {
  const lower = originalName.toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mime.includes('pdf') || lower.endsWith('.pdf')) {
    let text = '';
    let usedFallback = false;

    // pdf-parse is CommonJS
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text?: string }>;
    const data = await pdfParse(buffer);
    text = (data.text || '').trim();

    if (process.env.RESUME_PDFPLUMBER_ENABLED === 'true' && shouldFallbackToPdfplumber(text)) {
      try {
        text = await extractTextWithResumeParser(buffer, mimeType, originalName);
        usedFallback = true;
      } catch (error) {
        logger.warn(
          `resume-parser fallback failed name=${originalName} error=${error instanceof Error ? error.message : 'unknown'}`
        );
      }
    }

    if (text.length < MIN_EXTRACTED_LENGTH) {
      throw new Error('Не удалось извлечь достаточно текста из PDF. Попробуйте другой файл или вставьте текст вручную.');
    }
    logger.info(
      `resume extraction method=${usedFallback ? 'pdfplumber' : 'pdf-parse'} length=${text.length}`
    );
    return text;
  }

  if (
    mime.includes('wordprocessingml') ||
    mime.includes('msword') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.doc')
  ) {
    if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
      throw new Error('Формат .doc не поддерживается. Сохраните файл как DOCX или PDF.');
    }
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || '').trim();
    if (text.length < MIN_EXTRACTED_LENGTH) {
      throw new Error('Не удалось извлечь достаточно текста из DOCX. Попробуйте другой файл или вставьте текст вручную.');
    }
    return text;
  }

  logger.warn(`Unsupported resume mime=${mimeType} name=${originalName}`);
  throw new Error('Поддерживаются только PDF и DOCX.');
}
