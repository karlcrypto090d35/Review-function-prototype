import { useEffect, useState } from 'react';
import { useReviewStore } from '../store/reviewStore';
import type { Call } from '../lib/types';

/**
 * Returns:
 * - status: 'loading' | 'not_ready' | 'ready'
 * - call: Call | null
 * Performs timeout check and writes auto_timeout terminal status.
 */
export function useReviewGuard(callId: string) {
  const [tick, setTick] = useState(0);
  const call = useReviewStore((s) => s.getCall(callId));
  const setStatus = useReviewStore((s) => s.setStatus);
  const forceTimeoutCallId = useReviewStore((s) => s.forceTimeoutCallId);
  const setForceTimeout = useReviewStore((s) => s.setForceTimeout);

  useEffect(() => {
    if (!call) return;
    if (call.reviewStatus !== 'pending') return;
    const now = Date.now();
    const expired = call.reviewDeadline ? new Date(call.reviewDeadline).getTime() < now : false;
    if (expired || forceTimeoutCallId === callId) {
      setStatus(callId, 'auto_timeout');
      if (forceTimeoutCallId === callId) setForceTimeout(null);
      setTick((t) => t + 1);
    }
  }, [call, callId, setStatus, forceTimeoutCallId, setForceTimeout]);

  // re-check on focus
  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (!call) {
    return { status: 'not_ready' as const, call: null as Call | null };
  }
  if (!call.agentEvaluation || !call.reviewDeadline) {
    return { status: 'not_ready' as const, call: null as Call | null };
  }
  return { status: 'ready' as const, call };
}

export function checkTimeoutNow(callId: string): boolean {
  const call = useReviewStore.getState().getCall(callId);
  if (!call) return false;
  if (call.reviewStatus !== 'pending') return false;
  const force = useReviewStore.getState().forceTimeoutCallId === callId;
  const expired = call.reviewDeadline ? new Date(call.reviewDeadline).getTime() < Date.now() : false;
  if (expired || force) {
    useReviewStore.getState().setStatus(callId, 'auto_timeout');
    if (force) useReviewStore.getState().setForceTimeout(null);
    return true;
  }
  return false;
}
