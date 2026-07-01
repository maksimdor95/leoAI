/** Вопросы детального пути Jack (career_overview → additional_info). */
export const JACK_DETAILED_QUESTION_IDS = [
  'career_overview',
  'total_experience',
  'positions_count',
  'position_intro',
  'position_1_company',
  'position_1_role',
  'position_1_industry',
  'position_1_team',
  'position_1_responsibilities',
  'position_1_achievements',
  'position_1_projects',
  'position_2_company',
  'position_2_role',
  'position_2_industry',
  'position_2_team',
  'position_2_achievements',
  'position_3_company',
  'position_3_role',
  'position_3_achievements',
  'position_4_company',
  'position_4_role',
  'position_4_achievements',
  'position_5_company',
  'position_5_role',
  'position_5_achievements',
  'education_main',
  'education_additional',
  'skills_hard',
  'skills_soft',
  'skills_languages',
  'desired_role',
  'desired_location',
  'desired_salary',
  'desired_culture',
  'desired_start',
  'additional_info',
] as const;

const QUICK_PATH_STEP_IDS = new Set([
  'greeting',
  'quick_role',
  'quick_experience',
  'quick_location',
  'quick_ready',
  'pause_reminder',
  'privacy_info',
  'clarify',
]);

/** Путь «готовое резюме» — не детальная анкета, счётчик «N из 36» не показываем. */
const RESUME_PATH_STEP_IDS = new Set(['resume_upload', 'resume_ready']);

const DETAILED_SET = new Set<string>(JACK_DETAILED_QUESTION_IDS);

export function getJackDetailedProgress(
  currentStepId: string | null | undefined,
  completedSteps: string[] = []
): { current: number; total: number; label: string } | null {
  if (
    !currentStepId ||
    QUICK_PATH_STEP_IDS.has(currentStepId) ||
    RESUME_PATH_STEP_IDS.has(currentStepId)
  ) {
    return null;
  }

  if (currentStepId === 'completion' || currentStepId === 'completion_gap') {
    return null;
  }

  const total = JACK_DETAILED_QUESTION_IDS.length;

  if (currentStepId === 'profile_snapshot') {
    const afterSkills = JACK_DETAILED_QUESTION_IDS.indexOf('skills_languages') + 1;
    return {
      current: afterSkills,
      total,
      label: `Вопрос ${afterSkills} из ${total}`,
    };
  }

  const currentIndex = JACK_DETAILED_QUESTION_IDS.indexOf(
    currentStepId as (typeof JACK_DETAILED_QUESTION_IDS)[number]
  );
  if (currentIndex >= 0) {
    return {
      current: currentIndex + 1,
      total,
      label: `Вопрос ${currentIndex + 1} из ${total}`,
    };
  }

  const completedDetailed = completedSteps.filter((id) => DETAILED_SET.has(id));
  if (completedDetailed.length > 0) {
    const lastCompleted = completedDetailed[completedDetailed.length - 1];
    const lastIndex = JACK_DETAILED_QUESTION_IDS.indexOf(
      lastCompleted as (typeof JACK_DETAILED_QUESTION_IDS)[number]
    );
    if (lastIndex >= 0) {
      const current = Math.min(lastIndex + 1, total);
      return { current, total, label: `Вопрос ${current} из ${total}` };
    }
  }

  return null;
}
