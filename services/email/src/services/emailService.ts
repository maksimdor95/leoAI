/**
 * Email Service
 * Handles email sending via SMTP (Yandex Mail) or SendGrid
 * Priority: SMTP > SendGrid
 */

import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { compileTemplate, TemplateName } from './templateService';

// Ensure env is loaded before reading SMTP/SendGrid vars at module load time.
dotenv.config({ override: true });

// SMTP Configuration (Yandex Mail)
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';

// SendGrid Configuration (fallback)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';

// Email sender configuration
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@jack.ai';
const FROM_NAME = process.env.FROM_NAME || 'Jack AI';

// Initialize SendGrid (if configured)
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Initialize Nodemailer transporter (if SMTP configured)
let transporter: nodemailer.Transporter | null = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
    logger.info(`SMTP transporter initialized for ${SMTP_HOST}:${SMTP_PORT}`);
  } catch (error) {
    logger.error('Failed to initialize SMTP transporter:', error);
  }
} else if (!SENDGRID_API_KEY) {
  logger.warn('Neither SMTP nor SendGrid configured. Email sending will be disabled.');
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email via SMTP (Yandex Mail) or SendGrid (fallback)
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  // Try SMTP first (Yandex Mail)
  if (transporter) {
    try {
      const textContent = options.text || options.html.replace(/<[^>]*>/g, '');
      
      await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        text: textContent,
        html: options.html,
      });
      
      logger.info(`Email sent successfully via SMTP to ${options.to}`);
      return true;
    } catch (error: unknown) {
      logger.error('Failed to send email via SMTP:', error);
      // Fallback to SendGrid if SMTP fails
      if (SENDGRID_API_KEY) {
        logger.info('Falling back to SendGrid...');
      } else {
        return false;
      }
    }
  }

  // Fallback to SendGrid
  if (SENDGRID_API_KEY) {
    try {
      const msg = {
        to: options.to,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
        html: options.html,
      };

      await sgMail.send(msg);
      logger.info(`Email sent successfully via SendGrid to ${options.to}`);
      return true;
    } catch (error: unknown) {
      logger.error('Failed to send email via SendGrid:', error);
      if (error instanceof Error && 'response' in error) {
        const sgError = error as { response?: { body?: unknown } };
        logger.error('SendGrid error details:', sgError.response?.body);
      }
      return false;
    }
  }

  // No email service configured
  logger.warn('No email service configured. Email not sent.');
  logger.info('Would send email:', {
    to: options.to,
    subject: options.subject,
  });
  return false;
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(userEmail: string, userName?: string): Promise<boolean> {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const html = await compileTemplate(TemplateName.WELCOME, {
      userName: userName || 'друг',
      baseUrl,
    });

    return await sendEmail({
      to: userEmail,
      subject: 'Добро пожаловать в Jack AI!',
      html,
    });
  } catch (error: unknown) {
    logger.error('Failed to send welcome email:', error);
    return false;
  }
}

/**
 * Send jobs digest email
 */
export async function sendJobsDigestEmail(
  userEmail: string,
  userName: string | undefined,
  jobs: Array<{
    job: {
      id: string;
      title: string;
      company: string;
      location: string[];
      salary_min?: number | null;
      salary_max?: number | null;
      currency?: string | null;
      description: string;
      source_url: string;
    };
    score: number;
    reasons: string[];
  }>
): Promise<boolean> {
  try {
    const html = await compileTemplate(TemplateName.JOBS_DIGEST, {
      userName: userName || 'друг',
      jobs: jobs.map((item) => ({
        title: item.job.title,
        company: item.job.company,
        location: item.job.location.join(', '),
        salary: formatSalary(item.job.salary_min, item.job.salary_max, item.job.currency),
        description: item.job.description.substring(0, 200) + '...',
        score: item.score,
        reasons: item.reasons,
        url: item.job.source_url,
      })),
    });

    return await sendEmail({
      to: userEmail,
      subject: `Подборка вакансий для вас (${jobs.length} вакансий)`,
      html,
    });
  } catch (error: unknown) {
    logger.error('Failed to send jobs digest email:', error);
    return false;
  }
}

export async function sendResumePackageEmail(params: {
  userEmail: string;
  userName?: string;
  resume: string;
  coverLetter: string;
}): Promise<boolean> {
  const { userEmail, userName, resume, coverLetter } = params;
  const safeName = userName?.trim() || 'кандидат';
  const resumeHtml = resume
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  const coverLetterHtml = coverLetter
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:760px;margin:0 auto;">
    <h2 style="margin:0 0 12px;">Резюме и сопроводительное письмо</h2>
    <p style="margin:0 0 20px;">Здравствуйте, ${safeName}! Ниже материалы, сгенерированные LEO на основе вашего профиля.</p>

    <h3 style="margin:20px 0 8px;">Сопроводительное письмо</h3>
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;">${coverLetterHtml}</div>

    <h3 style="margin:20px 0 8px;">Резюме (черновик)</h3>
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;">${resumeHtml}</div>
  </div>`;

  return sendEmail({
    to: userEmail,
    subject: 'Ваше резюме и сопроводительное письмо от LEO',
    html,
  });
}

/**
 * Format salary range
 */
function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined
): string {
  if (!min && !max) {
    return 'Зарплата не указана';
  }

  const curr = currency || '₽';
  if (min && max) {
    return `${min.toLocaleString('ru-RU')} - ${max.toLocaleString('ru-RU')} ${curr}`;
  } else if (min) {
    return `от ${min.toLocaleString('ru-RU')} ${curr}`;
  } else if (max) {
    return `до ${max.toLocaleString('ru-RU')} ${curr}`;
  }

  return 'Зарплата не указана';
}
