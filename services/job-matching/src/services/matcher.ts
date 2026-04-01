/**
 * Job Matcher Service
 * Rule-based matching algorithm for matching jobs to user profiles
 */

import { Job } from '../models/job';
import { CollectedData } from './userService';

export interface MatchingScore {
  job: Job;
  score: number; // 0-100
  reasons: string[];
}

/**
 * Match jobs based on user profile and collected data
 */
export function matchJobs(
  jobs: Job[],
  collectedData: CollectedData | null,
  userPreferences?: {
    location?: string[];
    workMode?: string;
  }
): MatchingScore[] {
  const scoredJobs: MatchingScore[] = [];

  for (const job of jobs) {
    const score = calculateMatchScore(job, collectedData, userPreferences);
    if (score.score >= 30) {
      // Only include jobs with score >= 30
      scoredJobs.push(score);
    }
  }

  // Sort by score descending
  scoredJobs.sort((a, b) => b.score - a.score);

  return scoredJobs;
}

/**
 * Calculate match score for a single job (0-100)
 */
function calculateMatchScore(
  job: Job,
  collectedData: CollectedData | null,
  userPreferences?: {
    location?: string[];
    workMode?: string;
  }
): MatchingScore {
  let score = 0;
  const reasons: string[] = [];

  if (!collectedData) {
    // If no collected data, return low score but don't exclude
    return {
      job,
      score: 20,
      reasons: ['Недостаточно данных о пользователе'],
    };
  }

  // 1. Location matching (25 points)
  const locationScore = matchLocation(job, collectedData, userPreferences);
  score += locationScore.points;
  if (locationScore.reason) {
    reasons.push(locationScore.reason);
  }

  // 2. Experience level matching (20 points)
  const experienceScore = matchExperience(job, collectedData);
  score += experienceScore.points;
  if (experienceScore.reason) {
    reasons.push(experienceScore.reason);
  }

  // 3. Skills matching (30 points)
  const skillsScore = matchSkills(job, collectedData);
  score += skillsScore.points;
  if (skillsScore.reason) {
    reasons.push(skillsScore.reason);
  }

  // 4. Desired role matching (15 points)
  const roleScore = matchRole(job, collectedData);
  score += roleScore.points;
  if (roleScore.reason) {
    reasons.push(roleScore.reason);
  }

  // 5. Work mode matching (10 points)
  const workModeScore = matchWorkMode(job, collectedData, userPreferences);
  score += workModeScore.points;
  if (workModeScore.reason) {
    reasons.push(workModeScore.reason);
  }

  return {
    job,
    score: Math.min(100, Math.round(score)),
    reasons,
  };
}

/**
 * Match location (25 points max)
 */
function matchLocation(
  job: Job,
  collectedData: CollectedData,
  userPreferences?: { location?: string[] }
): { points: number; reason?: string } {
  const userLocations = userPreferences?.location || collectedData.location || [];
  if (userLocations.length === 0) {
    return { points: 10, reason: 'Локация не указана' };
  }

  // Check if any user location matches job location
  const jobLocations = job.location.map((loc: string) => loc.toLowerCase());
  const userLocationsLower = userLocations.map((loc: string) => loc.toLowerCase());

  // Check for exact match
  for (const userLoc of userLocationsLower) {
    for (const jobLoc of jobLocations) {
      if (jobLoc.includes(userLoc) || userLoc.includes(jobLoc)) {
        return { points: 25, reason: `Совпадение по локации: ${userLoc}` };
      }
    }
  }

  // Check for remote work
  if (jobLocations.some((loc) => loc.includes('удаленно') || loc.includes('remote'))) {
    return { points: 20, reason: 'Удаленная работа' };
  }

  return { points: 0, reason: 'Несовпадение по локации' };
}

/**
 * Match experience level (20 points max)
 */
function matchExperience(
  job: Job,
  collectedData: CollectedData
): { points: number; reason?: string } {
  const userExperience = collectedData.totalExperience || 0;
  if (!job.experience_level) {
    return { points: 10, reason: 'Уровень опыта не указан в вакансии' };
  }

  let expectedExperience: number;
  switch (job.experience_level) {
    case 'junior':
      expectedExperience = 0;
      break;
    case 'middle':
      expectedExperience = 3;
      break;
    case 'senior':
      expectedExperience = 6;
      break;
    default:
      return { points: 10 };
  }

  const diff = Math.abs(userExperience - expectedExperience);
  if (diff === 0) {
    return { points: 20, reason: `Идеальное совпадение опыта: ${job.experience_level}` };
  } else if (diff <= 1) {
    return { points: 15, reason: `Близкое совпадение опыта: ${job.experience_level}` };
  } else if (diff <= 2) {
    return { points: 10, reason: `Частичное совпадение опыта: ${job.experience_level}` };
  } else {
    return { points: 0, reason: 'Несовпадение по опыту' };
  }
}

/**
 * Match skills (30 points max)
 */
function matchSkills(job: Job, collectedData: CollectedData): { points: number; reason?: string } {
  const userSkills = collectedData.skills || [];
  if (userSkills.length === 0 || job.skills.length === 0) {
    return { points: 5, reason: 'Навыки не указаны' };
  }

  const userSkillsLower = userSkills.map((skill: string) => skill.toLowerCase());
  const jobSkillsLower = job.skills.map((skill: string) => skill.toLowerCase());

  const matchingSkills: string[] = [];
  for (const jobSkill of jobSkillsLower) {
    for (const userSkill of userSkillsLower) {
      if (jobSkill.includes(userSkill) || userSkill.includes(jobSkill)) {
        matchingSkills.push(jobSkill);
        break;
      }
    }
  }

  const matchRatio = matchingSkills.length / Math.max(jobSkillsLower.length, 1);
  const points = Math.round(matchRatio * 30);

  if (matchingSkills.length > 0) {
    return {
      points,
      reason: `Совпадающие навыки: ${matchingSkills.slice(0, 3).join(', ')}`,
    };
  }

  return { points: 0, reason: 'Нет совпадающих навыков' };
}

/**
 * Match desired role (15 points max)
 */
function matchRole(job: Job, collectedData: CollectedData): { points: number; reason?: string } {
  const desiredRole = collectedData.desiredRole;
  if (!desiredRole) {
    return { points: 5, reason: 'Желаемая должность не указана' };
  }

  const jobTitleLower = job.title.toLowerCase();
  const desiredRoleLower = desiredRole.toLowerCase();

  // Check if job title contains desired role keywords
  const roleKeywords = desiredRoleLower.split(/[\s,]+/);
  let matches = 0;
  for (const keyword of roleKeywords) {
    if (keyword.length > 2 && jobTitleLower.includes(keyword)) {
      matches++;
    }
  }

  if (matches > 0) {
    const points = Math.min(15, matches * 5);
    return { points, reason: `Совпадение по должности: ${desiredRole}` };
  }

  return { points: 0, reason: 'Несовпадение по должности' };
}

/**
 * Match work mode (10 points max)
 */
function matchWorkMode(
  job: Job,
  collectedData: CollectedData,
  userPreferences?: { workMode?: string }
): { points: number; reason?: string } {
  const userWorkMode = userPreferences?.workMode || collectedData.workMode;
  if (!userWorkMode || !job.work_mode) {
    return { points: 5, reason: 'Режим работы не указан' };
  }

  const userModeLower = userWorkMode.toLowerCase();
  const jobModeLower = job.work_mode.toLowerCase();

  if (userModeLower === jobModeLower) {
    return { points: 10, reason: `Совпадение режима работы: ${job.work_mode}` };
  }

  // Remote can match with hybrid
  if (
    (userModeLower === 'remote' && jobModeLower === 'hybrid') ||
    (userModeLower === 'hybrid' && jobModeLower === 'remote')
  ) {
    return { points: 7, reason: 'Частичное совпадение режима работы' };
  }

  return { points: 0, reason: 'Несовпадение режима работы' };
}
