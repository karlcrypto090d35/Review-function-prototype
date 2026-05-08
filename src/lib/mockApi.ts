import type { BadType } from './types';
import { useReviewStore } from '../store/reviewStore';

export async function apiEvaluate(
  badType: BadType | null,
  expectedAnswer: string
): Promise<{ result: 'pass' | 'fail' }> {
  await new Promise((r) => setTimeout(r, 250));
  const force = useReviewStore.getState().forceEvaluate;
  if (force) {
    useReviewStore.getState().setForceEvaluate(null);
    return { result: force };
  }
  // default heuristic: pass if non-empty and length >= 8
  const ok = !!badType && expectedAnswer.trim().length >= 8;
  return { result: ok ? 'pass' : 'fail' };
}

export async function apiCloseReview(callId: string) {
  await new Promise((r) => setTimeout(r, 1000));
  useReviewStore.getState().setStatus(callId, 'user_close');
  console.log('[mockApi] POST /api/review/close', { callId });
}

export async function apiSubmitReview(callId: string) {
  await new Promise((r) => setTimeout(r, 1500));
  const payload = useReviewStore.getState().submitReview(callId);
  console.log('[mockApi] POST /api/review/submit', payload);
  // fire-and-forget memory job
  setTimeout(() => {
    console.log('[mockApi] POST /api/memory-job dispatched (async, decoupled)', payload);
  }, 100);
  return payload;
}

export interface AIMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
  isReference?: boolean;
}

export function aiAssistInitialMessages(): AIMessage[] {
  return [
    {
      id: 'ai-1',
      role: 'ai',
      text: '你好,我是 AI 辅助助手。请用一句话告诉我:在这个问题上,你最想强调的事实或细节是什么?',
    },
  ];
}

export async function apiAIAssistReply(
  history: AIMessage[],
  userInput: string
): Promise<AIMessage[]> {
  await new Promise((r) => setTimeout(r, 400));
  const userTurns = history.filter((m) => m.role === 'user').length;
  if (userTurns === 0) {
    return [
      {
        id: `ai-${Date.now()}`,
        role: 'ai',
        text: '了解。再补充一点:你希望以怎样的语气来回复 HR?(例如:专业克制 / 热情主动)',
      },
    ];
  }
  // produce reference
  const refText = `根据你的补充,我建议参考以下表述(请手动复制到输入框):\n\n"${userInput.trim()}。综合来看,我的核心优势是能将上述能力快速落地到业务场景中,期待与团队进一步交流。"`;
  return [
    {
      id: `ai-${Date.now()}`,
      role: 'ai',
      text: refText,
      isReference: true,
    },
  ];
}
