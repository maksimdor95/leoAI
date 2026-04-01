import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import {
  GenerateReportRequest,
  ReportRecord,
  ReportStatusResponse,
} from '../types/report';
import { reportGenerator } from './reportGenerator';
import { pdfGenerator } from './pdfGenerator';
import { storageService } from './storageService';

const REPORT_PREFIX = 'report:';
const REPORT_TTL = 60 * 60 * 24 * 7; // 7 days

export const reportService = {
  async initiateGeneration(request: GenerateReportRequest): Promise<ReportStatusResponse> {
    const reportId = uuidv4();
    const redis = getRedisClient();

    // Create report record
    const record: ReportRecord = {
      id: reportId,
      sessionId: request.sessionId,
      userId: request.userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Redis
    await redis.set(
      `${REPORT_PREFIX}${reportId}`,
      JSON.stringify(record),
      'EX',
      REPORT_TTL
    );

    // Start async generation (fire and forget)
    this.generateAsync(reportId, request).catch((error) => {
      logger.error('Async report generation failed', { reportId, error: error.message });
    });

    return {
      reportId,
      status: 'pending',
    };
  },

  async generateAsync(reportId: string, request: GenerateReportRequest): Promise<void> {
    const redis = getRedisClient();
    const recordKey = `${REPORT_PREFIX}${reportId}`;

    try {
      // Update status to generating
      await this.updateStatus(reportId, 'generating');

      logger.info('Starting report generation', { reportId, sessionId: request.sessionId });

      // 1. Fetch session data and generate report content
      const reportData = await reportGenerator.generateReportData(
        request.sessionId,
        request.userId,
        request.email
      );

      // 2. Generate PDF from report data
      const pdfBuffer = await pdfGenerator.generatePdf(reportData);

      // 3. Upload to storage
      const s3Key = `reports/${request.userId}/${reportId}.pdf`;
      const pdfUrl = await storageService.uploadPdf(pdfBuffer, s3Key);

      // 4. Update record with success
      const record = await this.getRecord(reportId);
      if (record) {
        record.status = 'ready';
        record.pdfUrl = pdfUrl;
        record.s3Key = s3Key;
        record.updatedAt = new Date().toISOString();
        await redis.set(recordKey, JSON.stringify(record), 'EX', REPORT_TTL);
      }

      logger.info('Report generation completed', { reportId, s3Key });
    } catch (error) {
      logger.error('Report generation error', { reportId, error: (error as Error).message });
      await this.updateStatus(reportId, 'error', (error as Error).message);
    }
  },

  async updateStatus(
    reportId: string,
    status: ReportRecord['status'],
    error?: string
  ): Promise<void> {
    const redis = getRedisClient();
    const record = await this.getRecord(reportId);

    if (record) {
      record.status = status;
      record.updatedAt = new Date().toISOString();
      if (error) record.error = error;

      await redis.set(
        `${REPORT_PREFIX}${reportId}`,
        JSON.stringify(record),
        'EX',
        REPORT_TTL
      );
    }
  },

  async getRecord(reportId: string): Promise<ReportRecord | null> {
    const redis = getRedisClient();
    const data = await redis.get(`${REPORT_PREFIX}${reportId}`);
    return data ? JSON.parse(data) : null;
  },

  async getStatus(reportId: string, userId: string): Promise<ReportStatusResponse | null> {
    const record = await this.getRecord(reportId);

    if (!record || record.userId !== userId) {
      return null;
    }

    return {
      reportId: record.id,
      status: record.status,
      url: record.status === 'ready' ? record.pdfUrl : undefined,
      error: record.error,
    };
  },

  async getDownloadUrl(reportId: string, userId: string): Promise<string | null> {
    const record = await this.getRecord(reportId);

    if (!record || record.userId !== userId || record.status !== 'ready') {
      return null;
    }

    if (record.s3Key) {
      // Generate fresh signed URL
      return await storageService.getSignedUrl(record.s3Key);
    }

    return record.pdfUrl || null;
  },
};
