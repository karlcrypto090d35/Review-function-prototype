export type BadType = 'fact_mismatch' | 'incomplete' | 'style_mismatch';

export const BAD_TYPE_LABEL: Record<BadType, string> = {
  fact_mismatch: '不符合事实',
  incomplete: '不完整',
  style_mismatch: '不适配风格',
};

export type ReviewStatus = 'pending' | 'done' | 'auto_timeout' | 'user_close';

export interface ReviewDraft {
  currentMark: null | 'good' | 'bad';
  badTypeDraft: BadType | null;
  expectedAnswerDraft: string;
  isBadCompleted: boolean;
}

export type MarkResult =
  | null
  | { type: 'good' }
  | { type: 'bad'; badType: BadType; expectedAnswer: string };

export interface Entry {
  entryId: string;
  hrQuestion: string;
  agentAnswer: string;
  hrSingleComment: string | null;
  valueRating: 'high' | 'low';
  markResult: MarkResult;
  reviewDraft: ReviewDraft;
}

export interface AgentEvaluation {
  factualAccuracy: 'normal' | 'abnormal';
  completeness: 'normal' | 'abnormal';
  styleConsistency: 'normal' | 'abnormal';
}

export interface Call {
  callId: string;
  jobTitle: string;
  hrId: string;
  startTime: string;
  hrOverallComment: string;
  agentEvaluation?: AgentEvaluation;
  reviewDeadline?: string;
  reviewStatus: ReviewStatus;
  entries: Entry[];
}

export interface MemoryPayload {
  callId: string;
  triggerTime: string;
  learningUnits: Array<{
    entryId: string;
    hrQuestion: string;
    agentAnswer: string;
    markResult: MarkResult;
  }>;
}

export const EMPTY_DRAFT: ReviewDraft = {
  currentMark: null,
  badTypeDraft: null,
  expectedAnswerDraft: '',
  isBadCompleted: false,
};
