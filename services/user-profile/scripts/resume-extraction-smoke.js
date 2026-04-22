#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const pdfParse = require('pdf-parse');

const MIN_EXTRACTED_LENGTH = 20;
const RESUME_PARSER_URL = process.env.RESUME_PARSER_URL || 'http://localhost:3011';
const TIMEOUT_MS = Number(process.env.RESUME_PARSER_TIMEOUT_MS || '2500');

function calcTextQualityScore(text) {
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

function postJson(urlString, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`resume-parser http ${res.statusCode || 500}: ${data}`));
            return;
          }
          resolve(data);
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('resume-parser timeout')));
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

async function extractWithPdfplumber(pdfBuffer, fileName) {
  const raw = await postJson(
    `${RESUME_PARSER_URL}/extract-text`,
    {
      filename: fileName,
      mimeType: 'application/pdf',
      contentBase64: pdfBuffer.toString('base64'),
    },
    TIMEOUT_MS
  );
  const parsed = JSON.parse(raw);
  return (parsed.text || '').trim();
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      'Usage: node services/user-profile/scripts/resume-extraction-smoke.js <path-to-pdf>'
    );
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(absolutePath);
  const fileName = path.basename(absolutePath);

  const t0 = Date.now();
  const parsed = await pdfParse(buffer);
  const textPdfParse = (parsed.text || '').trim();
  const d0 = Date.now() - t0;
  const q0 = calcTextQualityScore(textPdfParse);

  const t1 = Date.now();
  const textPdfplumber = await extractWithPdfplumber(buffer, fileName);
  const d1 = Date.now() - t1;
  const q1 = calcTextQualityScore(textPdfplumber);

  console.log('== Resume Extraction Smoke ==');
  console.log(`File: ${absolutePath}`);
  console.log(`pdf-parse   => chars=${textPdfParse.length}, quality=${q0.toFixed(3)}, ms=${d0}`);
  console.log(
    `pdfplumber  => chars=${textPdfplumber.length}, quality=${q1.toFixed(3)}, ms=${d1}`
  );
  console.log('');

  const winner =
    textPdfplumber.length >= MIN_EXTRACTED_LENGTH &&
    (q1 > q0 + 0.03 || textPdfplumber.length > textPdfParse.length * 1.1)
      ? 'pdfplumber'
      : 'pdf-parse';

  console.log(`Suggested extractor: ${winner}`);
}

main().catch((err) => {
  console.error(`Smoke failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
