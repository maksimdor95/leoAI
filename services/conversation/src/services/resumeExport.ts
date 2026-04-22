import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import fs from 'fs';
import path from 'path';

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function resolvePdfUnicodeFontPath(): string | null {
  // 1) Пользовательский оверрайд через env.
  const fromEnv = process.env.PDF_UNICODE_FONT_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  // 2) Локальный шрифт внутри проекта (если добавим позже в репозиторий).
  const localCandidates = [
    path.resolve(process.cwd(), 'assets/fonts/DejaVuSans.ttf'),
    path.resolve(process.cwd(), 'frontend/public/fonts/DejaVuSans.ttf'),
  ];
  for (const p of localCandidates) {
    if (fs.existsSync(p)) return p;
  }

  // 3) Системные пути (macOS/Linux) — чтобы не тащить бинарник в git.
  const systemCandidates = [
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
    '/Library/Fonts/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  ];
  for (const p of systemCandidates) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

export async function generateResumePdfBuffer(markdownResume: string): Promise<Buffer> {
  const text = markdownToPlainText(markdownResume);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 42, right: 42 },
    info: {
      Title: 'Resume',
      Author: 'LEO AI',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const unicodeFontPath = resolvePdfUnicodeFontPath();
  if (unicodeFontPath) {
    // Без Unicode-шрифта PDFKit даёт «кракозябры» на кириллице.
    doc.font(unicodeFontPath);
  }

  doc.fontSize(18).text('Резюме', { align: 'left' });
  doc.moveDown(0.8);
  doc.fontSize(11).text(text, {
    align: 'left',
    lineGap: 3,
  });
  doc.end();

  return done;
}

export async function generateResumeDocxBuffer(markdownResume: string): Promise<Buffer> {
  const lines = markdownResume.split(/\r?\n/);
  const paragraphs: Paragraph[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }
    if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^###\s+/, ''),
          heading: HeadingLevel.HEADING_3,
        })
      );
      continue;
    }
    if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^##\s+/, ''),
          heading: HeadingLevel.HEADING_2,
        })
      );
      continue;
    }
    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^#\s+/, ''),
          heading: HeadingLevel.HEADING_1,
        })
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^[-*]\s+/, ''),
          bullet: { level: 0 },
        })
      );
      continue;
    }
    paragraphs.push(new Paragraph({ text: line }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

