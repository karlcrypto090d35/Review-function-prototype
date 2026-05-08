import type { Call, Entry } from './types';
import { EMPTY_DRAFT } from './types';

const mkEntry = (
  i: number,
  q: string,
  a: string,
  c: string | null,
  high: boolean
): Entry => ({
  entryId: `e${i}`,
  hrQuestion: q,
  agentAnswer: a,
  hrSingleComment: c,
  valueRating: high ? 'high' : 'low',
  markResult: null,
  reviewDraft: { ...EMPTY_DRAFT },
});

// Scenario A entries: 4 high, 6 low; one high has null comment
const scenarioAEntries: Entry[] = [
  mkEntry(1, '请简要介绍一下你的工作经历?', '我有 5 年前端开发经验，主要使用 React 和 TypeScript，曾在两家互联网公司任职。', '回答略简，可补充关键项目', true),
  mkEntry(2, '你为什么从上一家公司离职?', '主要是希望寻找更具挑战性的技术方向，特别是 AI 相关产品方向。', null, true),
  mkEntry(3, '期望薪资是多少?', '我期望的薪资范围是 35K-45K，可根据整体 package 协商。', '与岗位预算基本匹配', true),
  mkEntry(4, '能接受加班吗?', '能接受合理的加班，希望整体工作节奏健康可持续。', '回答中性偏保守', true),
  mkEntry(5, '你目前在哪个城市?', '我目前在上海。', null, false),
  mkEntry(6, '英语水平如何?', 'CET-6，能阅读英文技术文档与基本沟通。', null, false),
  mkEntry(7, '是否有团队管理经验?', '曾带过 3 人小组，负责技术方案与进度推进。', null, false),
  mkEntry(8, '什么时候可以入职?', '一个月内可入职。', null, false),
  mkEntry(9, '了解我们公司业务吗?', '了解贵司主要做企业级 SaaS 产品，近期在 AI 方向有较大投入。', null, false),
  mkEntry(10, '有什么想问 HR 的?', '想了解团队规模、技术栈以及晋升机制。', null, false),
];

// Fixed timestamps to avoid SSR/CSR hydration mismatch
// (Date.now() at module load differs between server render and client hydration).
const FIXED_START_A = '2026-05-08T07:00:00.000Z';
const FIXED_START_B = '2026-05-08T06:00:00.000Z';
const FIXED_START_C = '2026-04-08T08:00:00.000Z';
const FIXED_START_D = '2026-05-08T03:00:00.000Z';
// Deadlines are only used for runtime expiry checks (not rendered),
// so it's safe to compute them relative to "now" at module load.
const inFuture = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString();
const inPast = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

export const SCENARIOS: Record<string, Call> = {
  'call-A': {
    callId: 'call-A',
    jobTitle: '高级前端工程师',
    hrId: 'HR-001',
    startTime: inPast(60),
    hrOverallComment: '整体应答流畅，部分关键问题可更具体。',
    agentEvaluation: {
      factualAccuracy: 'normal',
      completeness: 'abnormal',
      styleConsistency: 'normal',
    },
    reviewDeadline: inFuture(60 * 24),
    reviewStatus: 'pending',
    entries: scenarioAEntries,
  },
  'call-B': {
    callId: 'call-B',
    jobTitle: 'AI 产品经理',
    hrId: 'HR-002',
    startTime: inPast(120),
    hrOverallComment: '部分问题回答偏模板化，建议补充个人案例。',
    agentEvaluation: {
      factualAccuracy: 'abnormal',
      completeness: 'normal',
      styleConsistency: 'normal',
    },
    reviewDeadline: inFuture(60 * 24),
    reviewStatus: 'pending',
    entries: scenarioAEntries.map((e, i) => {
      // index 0,1 high → good; index 2 high → bad-completed; index 3 high → bad-unfinished + history切到good
      if (i === 0)
        return {
          ...e,
          reviewDraft: { ...EMPTY_DRAFT, currentMark: 'good' },
        };
      if (i === 1)
        return {
          ...e,
          // 曾经从 bad 切回 good，但保留历史
          reviewDraft: {
            currentMark: 'good',
            badTypeDraft: 'incomplete',
            expectedAnswerDraft: '我之所以离开是因为希望深入参与 AI Agent 的产品化工作。',
            isBadCompleted: false,
          },
        };
      if (i === 2)
        return {
          ...e,
          reviewDraft: {
            currentMark: 'bad',
            badTypeDraft: 'incomplete',
            expectedAnswerDraft: '我的期望薪资是 38K-45K，13 薪，并希望明确股票或期权部分。',
            isBadCompleted: true,
          },
        };
      if (i === 3)
        return {
          ...e,
          reviewDraft: {
            currentMark: 'bad',
            badTypeDraft: 'style_mismatch',
            expectedAnswerDraft: '',
            isBadCompleted: false,
          },
        };
      return e;
    }),
  },
  'call-C': {
    callId: 'call-C',
    jobTitle: '后端架构师',
    hrId: 'HR-003',
    startTime: inPast(60 * 30),
    hrOverallComment: '应答完整度尚可。',
    agentEvaluation: {
      factualAccuracy: 'normal',
      completeness: 'normal',
      styleConsistency: 'normal',
    },
    reviewDeadline: inPast(10), // already expired
    reviewStatus: 'pending',
    entries: scenarioAEntries.slice(0, 6),
  },
  'call-D': {
    callId: 'call-D',
    jobTitle: '设计师',
    hrId: 'HR-004',
    startTime: inPast(60 * 5),
    hrOverallComment: 'Review 已完成,可作为终态回放。',
    agentEvaluation: {
      factualAccuracy: 'normal',
      completeness: 'normal',
      styleConsistency: 'normal',
    },
    reviewDeadline: inFuture(60 * 24),
    reviewStatus: 'done',
    entries: scenarioAEntries.slice(0, 5).map((e, i) => ({
      ...e,
      reviewDraft: { ...EMPTY_DRAFT },
      markResult:
        i % 2 === 0
          ? { type: 'good' }
          : {
              type: 'bad',
              badType: 'incomplete',
              expectedAnswer: '更详细且具针对性的应答。',
            },
    })),
  },
};

export const SCENARIO_META = [
  { id: 'call-A', name: 'A. 正常待审', desc: 'pending,4 高 6 低,1 条 null 评论' },
  { id: 'call-B', name: 'B. 存在草稿', desc: '含 good / bad-completed / bad-unfinished / 切换历史' },
  { id: 'call-C', name: 'C. 超时关闭', desc: '加载即超时,自动收口为 auto_timeout' },
  { id: 'call-D', name: 'D. 已完成', desc: 'done 终态,只读回放' },
];
