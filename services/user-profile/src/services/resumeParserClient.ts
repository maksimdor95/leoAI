import http from 'http';
import https from 'https';
import { URL } from 'url';

type ExtractTextResponse = {
  status?: string;
  text?: string;
  meta?: {
    pages?: number;
    method?: string;
    hasTextLayer?: boolean;
    charCount?: number;
  };
};

function postJson(urlString: string, body: unknown, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
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
            reject(new Error(`resume-parser http ${res.statusCode || 500}`));
            return;
          }
          resolve(data);
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('resume-parser timeout'));
    });
    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

export async function extractTextWithResumeParser(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const baseUrl = process.env.RESUME_PARSER_URL || 'http://localhost:3011';
  const timeoutMs = Number(process.env.RESUME_PARSER_TIMEOUT_MS || '2500');
  const responseText = await postJson(
    `${baseUrl}/extract-text`,
    {
      filename,
      mimeType,
      contentBase64: buffer.toString('base64'),
    },
    timeoutMs
  );

  const parsed = JSON.parse(responseText) as ExtractTextResponse;
  const text = (parsed.text || '').trim();
  if (!text) {
    throw new Error('resume-parser returned empty text');
  }
  return text;
}
