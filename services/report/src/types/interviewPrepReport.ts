export interface PrepProgressComparison {
  priorRole: string;
  priorLevel?: string;
  priorReadinessPercent: number;
  currentReadinessPercent: number;
  readinessDelta: number;
  closedGaps: string[];
  remainingGaps: string[];
  newGaps: string[];
  competencyDeltas: Array<{
    dimension: string;
    label: string;
    priorScore?: number;
    currentScore: number;
    delta?: number;
  }>;
}

export interface InterviewPrepReportData {
  sessionId: string;
  generatedAt: string;
  role: string;
  level: string;
  company: string;
  readinessPercent: number;
  readinessStatus: string;
  executiveSummary: {
    strengths: string[];
    gaps: string[];
    actions: string[];
  };
  vacancyProfile: {
    role?: string;
    level?: string;
    domain?: string;
    stack?: string[];
    requirements?: string[];
    responsibilities?: string[];
  };
  competencyScores: Array<{ dimension: string; label: string; score: number }>;
  fatalGaps: string[];
  starStories: Array<{ title: string; structure: string }>;
  caseStructures: string[];
  employerQuestions: string[];
  checklist: Array<{ label: string; done: boolean }>;
  dayProgress: Array<{ day: number; focus: string; done: boolean }>;
  mockSummary?: string;
  cheatsheets: Array<{ packType: string; title: string; content: string }>;
  progressComparison?: PrepProgressComparison;
}
