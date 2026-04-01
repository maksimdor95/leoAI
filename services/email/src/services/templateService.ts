/**
 * Template Service
 * Handles email template compilation using Handlebars
 */

import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export enum TemplateName {
  WELCOME = 'welcome-email',
  JOBS_DIGEST = 'jobs-digest',
}

const templatesDir = path.join(__dirname, '../templates');

/**
 * Compile and render template
 */
export async function compileTemplate(
  templateName: TemplateName,
  data: Record<string, unknown>
): Promise<string> {
  try {
    const templatePath = path.join(templatesDir, `${templateName}.html`);

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      logger.error(`Template not found: ${templatePath}`);
      throw new Error(`Template ${templateName} not found`);
    }

    // Read template file
    const templateSource = fs.readFileSync(templatePath, 'utf-8');

    // Compile template
    const template = handlebars.compile(templateSource);

    // Render template with data
    const html = template(data);

    return html;
  } catch (error: unknown) {
    logger.error(`Failed to compile template ${templateName}:`, error);
    throw error;
  }
}
