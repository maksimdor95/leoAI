import axios from 'axios';
import { JobInput } from '../models/job';
import { logger } from '../utils/logger';

const AI_NLP_URL = process.env.AI_NLP_URL || 'http://localhost:3003';

export async function enrichJobWithLLM(job: JobInput): Promise<JobInput> {
  try {
    const response = await axios.post(`${AI_NLP_URL}/api/ai/enrich-job`, {
      title: job.title,
      description: job.description,
      requirements: job.requirements,
    }, { timeout: 15000 });

    const data = response.data;
    if (data) {
      if (Array.isArray(data.skills) && data.skills.length > 0) {
        // Merge skills, avoiding duplicates
        const newSkills = data.skills.filter((s: string) => typeof s === 'string');
        job.skills = Array.from(new Set([...job.skills, ...newSkills]));
      }
      if (data.experience_level && data.experience_level !== 'unknown') {
        job.experience_level = data.experience_level;
      }
      if (data.work_mode && data.work_mode !== 'unknown') {
        job.work_mode = data.work_mode;
      }
    }

    // Generate embedding for the job
    const textToEmbed = `${job.title} ${job.skills.join(' ')} ${job.experience_level || ''}`;
    job.embedding = await getEmbedding(textToEmbed);

  } catch (error) {
    logger.error(`Failed to enrich job ${job.source_url} via LLM:`, error instanceof Error ? error.message : String(error));
  }
  return job;
}

export async function getEmbedding(text: string, authToken?: string): Promise<number[]> {
  try {
    const response = await axios.post(
      `${AI_NLP_URL}/api/ai/embedding`,
      { text },
      {
        timeout: 15000,
        headers: authToken
          ? { Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}` }
          : undefined,
      }
    );
    return response.data?.embedding || [];
  } catch (error) {
    logger.error(`Failed to get embedding:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}
