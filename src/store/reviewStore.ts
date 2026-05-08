import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BadType, Call, Entry, MemoryPayload, ReviewDraft, ReviewStatus } from '../lib/types';
import { EMPTY_DRAFT } from '../lib/types';
import { SCENARIOS } from '../lib/mockData';

interface PersistedState {
  // per callId draft overrides
  drafts: Record<string, Record<string, ReviewDraft>>;
  // per callId overridden status (for terminal states)
  statuses: Record<string, ReviewStatus>;
  // per callId final markResults after submit
  results: Record<string, Record<string, Entry['markResult']>>;
  // dev flags
  forceEvaluate: 'pass' | 'fail' | null;
  forceTimeoutCallId: string | null;
  // analytics
  analytics: {
    aiAssistOpenByEntry: Record<string, number>; // entryId -> count
    aiAssistConvert: Record<string, boolean>;
    detailEnterAt: Record<string, number>;
    completeAt: Record<string, number>;
  };
}

interface ReviewStore extends PersistedState {
  getCall: (callId: string) => Call | null;
  saveDraft: (callId: string, entryId: string, draft: ReviewDraft) => void;
  setStatus: (callId: string, status: ReviewStatus) => void;
  clearDrafts: (callId: string) => void;
  submitReview: (callId: string) => MemoryPayload;
  setForceEvaluate: (v: 'pass' | 'fail' | null) => void;
  setForceTimeout: (callId: string | null) => void;
  resetScenario: (callId: string) => void;
  recordAIOpen: (entryId: string) => void;
  recordDetailEnter: (callId: string) => void;
  recordComplete: (callId: string) => void;
}

export const useReviewStore = create<ReviewStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      statuses: {},
      results: {},
      forceEvaluate: null,
      forceTimeoutCallId: null,
      analytics: {
        aiAssistOpenByEntry: {},
        aiAssistConvert: {},
        detailEnterAt: {},
        completeAt: {},
      },

      getCall: (callId) => {
        const base = SCENARIOS[callId];
        if (!base) return null;
        const state = get();
        const overrideStatus = state.statuses[callId];
        const status: ReviewStatus = overrideStatus ?? base.reviewStatus;
        const drafts = state.drafts[callId] ?? EMPTY_OBJ;
        const results = state.results[callId] ?? EMPTY_OBJ;
        return getCallMemo(callId, base, status, drafts, results);
      },

      saveDraft: (callId, entryId, draft) => {
        set((s) => ({
          drafts: {
            ...s.drafts,
            [callId]: { ...(s.drafts[callId] ?? {}), [entryId]: draft },
          },
        }));
        // simulate POST /api/draft/save
        console.log('[mockApi] POST /api/draft/save', { callId, entryId, draft });
      },

      setStatus: (callId, status) => {
        set((s) => ({ statuses: { ...s.statuses, [callId]: status } }));
        if (status !== 'pending') {
          // clear drafts on terminal
          set((s) => {
            const next = { ...s.drafts };
            delete next[callId];
            return { drafts: next };
          });
        }
      },

      clearDrafts: (callId) => {
        set((s) => {
          const next = { ...s.drafts };
          delete next[callId];
          return { drafts: next };
        });
      },

      submitReview: (callId) => {
        const call = get().getCall(callId);
        if (!call) throw new Error('Call not found');
        const learningUnits = call.entries
          .filter((e) => {
            const d = e.reviewDraft;
            return d.currentMark === 'good' || (d.currentMark === 'bad' && d.isBadCompleted);
          })
          .map((e) => {
            const d = e.reviewDraft;
            const markResult: Entry['markResult'] =
              d.currentMark === 'good'
                ? { type: 'good' }
                : {
                    type: 'bad',
                    badType: d.badTypeDraft as BadType,
                    expectedAnswer: d.expectedAnswerDraft,
                  };
            return {
              entryId: e.entryId,
              hrQuestion: e.hrQuestion,
              agentAnswer: e.agentAnswer,
              markResult,
            };
          });
        const payload: MemoryPayload = {
          callId,
          triggerTime: new Date().toISOString(),
          learningUnits,
        };
        // persist final results
        set((s) => {
          const map: Record<string, Entry['markResult']> = {};
          for (const u of learningUnits) map[u.entryId] = u.markResult;
          return { results: { ...s.results, [callId]: map } };
        });
        // status -> done, drafts cleared via setStatus
        get().setStatus(callId, 'done');
        return payload;
      },

      setForceEvaluate: (v) => set({ forceEvaluate: v }),
      setForceTimeout: (callId) => set({ forceTimeoutCallId: callId }),

      resetScenario: (callId) => {
        set((s) => {
          const drafts = { ...s.drafts };
          delete drafts[callId];
          const statuses = { ...s.statuses };
          delete statuses[callId];
          const results = { ...s.results };
          delete results[callId];
          return { drafts, statuses, results };
        });
      },

      recordAIOpen: (entryId) => {
        set((s) => ({
          analytics: {
            ...s.analytics,
            aiAssistOpenByEntry: {
              ...s.analytics.aiAssistOpenByEntry,
              [entryId]: (s.analytics.aiAssistOpenByEntry[entryId] ?? 0) + 1,
            },
          },
        }));
        console.log('[analytics] ai_assist_open', { entryId });
      },

      recordDetailEnter: (callId) => {
        set((s) => {
          if (s.analytics.detailEnterAt[callId]) return s;
          return {
            analytics: {
              ...s.analytics,
              detailEnterAt: { ...s.analytics.detailEnterAt, [callId]: Date.now() },
            },
          };
        });
      },

      recordComplete: (callId) => {
        set((s) => ({
          analytics: {
            ...s.analytics,
            completeAt: { ...s.analytics.completeAt, [callId]: Date.now() },
          },
        }));
      },
    }),
    {
      name: 'ai-review-store',
      partialize: (s) => ({
        drafts: s.drafts,
        statuses: s.statuses,
        results: s.results,
        analytics: s.analytics,
      }),
    }
  )
);
