export interface CollectedData {
  readyToStart?: string;
  pauseChoice?: string;
  clarifiedAnswer?: string;
  resumeOrIntro?: string;
  targetRole?: string;
  targetProductType?: string;
  pmCase?: string;
  interviewAnswer1?: string;
  interviewAnswer2?: string;
  interviewAnswer3?: string;
  [key: string]: string | undefined;
}

export interface ReportData {
  candidateName?: string;
  email?: string;
  targetRole: string;
  targetProductType: string;
  experience: string;
  pmCase: string;
  interviewAnswers: InterviewAnswer[];
  evaluation: ReportEvaluation;
  recommendations: string[];
  typicalQuestions: string[];
  generatedAt: string;
}

export interface InterviewAnswer {
  question: string;
  answer: string;
  category: string;
}

export interface ReportEvaluation {
  overallScore: number; // 1-10
  categoryScores: CategoryScore[];
  strengths: string[];
  areasForImprovement: string[];
}

export interface CategoryScore {
  category: string;
  score: number; // 1-10
  comment: string;
}

export interface ReportRecord {
  id: string;
  sessionId: string;
  userId: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  pdfUrl?: string;
  s3Key?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateReportRequest {
  sessionId: string;
  userId: string;
  email?: string;
}

export interface ReportStatusResponse {
  reportId: string;
  status: ReportRecord['status'];
  url?: string;
  error?: string;
}
