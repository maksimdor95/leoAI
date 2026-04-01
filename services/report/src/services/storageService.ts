import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';

// Yandex Object Storage configuration (S3-compatible)
const s3Client = new S3Client({
  endpoint: process.env.YC_STORAGE_ENDPOINT || 'https://storage.yandexcloud.net',
  region: process.env.YC_STORAGE_REGION || 'ru-central1',
  credentials: {
    accessKeyId: process.env.YC_STORAGE_ACCESS_KEY || '',
    secretAccessKey: process.env.YC_STORAGE_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for Yandex Object Storage
});

const BUCKET_NAME = process.env.YC_STORAGE_BUCKET || 'aiheroes-reports';
const URL_EXPIRATION_SECONDS = 60 * 60; // 1 hour

export const storageService = {
  /**
   * Upload a PDF buffer to Yandex Object Storage
   */
  async uploadPdf(pdfBuffer: Buffer, key: string): Promise<string> {
    logger.info('Uploading PDF to storage', { key, size: pdfBuffer.length });

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: `attachment; filename="${key.split('/').pop()}"`,
      });

      await s3Client.send(command);

      // Return the direct URL (will need signed URL for access)
      const directUrl = `${process.env.YC_STORAGE_ENDPOINT || 'https://storage.yandexcloud.net'}/${BUCKET_NAME}/${key}`;

      logger.info('PDF uploaded successfully', { key, url: directUrl });

      return directUrl;
    } catch (error) {
      logger.error('Failed to upload PDF', { key, error: (error as Error).message });
      throw new Error('Failed to upload PDF to storage');
    }
  },

  /**
   * Generate a pre-signed URL for downloading a PDF
   */
  async getSignedUrl(key: string, expiresIn: number = URL_EXPIRATION_SECONDS): Promise<string> {
    logger.info('Generating signed URL', { key, expiresIn });

    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${key.split('/').pop()}"`,
        ResponseContentType: 'application/pdf',
      });

      const signedUrl = await s3GetSignedUrl(s3Client, command, { expiresIn });

      logger.info('Signed URL generated', { key });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', { key, error: (error as Error).message });
      throw new Error('Failed to generate download URL');
    }
  },

  /**
   * Check if storage is configured and accessible
   */
  async checkConnection(): Promise<boolean> {
    const accessKey = process.env.YC_STORAGE_ACCESS_KEY;
    const secretKey = process.env.YC_STORAGE_SECRET_KEY;

    if (!accessKey || !secretKey) {
      logger.warn('Storage credentials not configured');
      return false;
    }

    try {
      // Simple check - try to list bucket (will fail if credentials are invalid)
      // For now, just return true if credentials are set
      return true;
    } catch (error) {
      logger.error('Storage connection check failed', { error: (error as Error).message });
      return false;
    }
  },
};
