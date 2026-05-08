import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useReviewGuard, checkTimeoutNow } from '../hooks/useReviewGuard';
import { EntryCard } from '../components/review/EntryCard';
import { MarkBadModal } from '../components/review/MarkBadModal';
import type { Entry } from '../lib/types';
import { useReviewStore } from '../store/reviewStore';
import { apiSubmitReview } from '../lib/mockApi';

export const Route = createFileRoute('/review/$callId/detail')({
  component: DetailPage,
});

function DetailPage() {
  const { callId } = Route.useParams();
  const { status, call } = useReviewGuard(callId);
  const navigate = useNavigate();
  const [activeEntry, setActiveEntry] = useState<Entry | null>(null);
  const [alertC, setAlertC] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const recordDetailEnter = useReviewStore((s) => s.recordDetailEnter);

  useEffect(() => {
    if (call && call.reviewStatus === 'pending') recordDetailEnter(callId);
  }, [call, callId, recordDetailEnter]);

  // redirect on terminal
  useEffect(() => {
    if (call && call.reviewStatus !== 'pending') {
      navigate({ to: '/review/$callId/summary', params: { callId }, replace: true });
    }
  }, [call, callId, navigate]);

  if (status === 'not_ready') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        数据准备中,请稍后重试
      </div>
    );
  }
  if (!call) return null;

  const isCompleted = (e: Entry) => {
    const d = e.reviewDraft;
    return d.currentMark === 'good' || (d.currentMark === 'bad' && d.isBadCompleted);
  };

  const total = call.entries.length;
  const done = call.entries.filter(isCompleted).length;
  const highTotal = call.entries.filter((e) => e.valueRating === 'high').length;
  const highDone = call.entries.filter((e) => e.valueRating === 'high' && isCompleted(e)).length;

  const handleSubmit = async () => {
    if (submitting) return;
    if (checkTimeoutNow(callId)) return; // will redirect
    const unfinishedHigh = call.entries.some((e) => e.valueRating === 'high' && !isCompleted(e));
    if (unfinishedHigh) {
      setAlertC(true);
      return;
    }
    await doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    await apiSubmitReview(callId);
    setSubmitting(false);
    navigate({ to: '/review/$callId/summary', params: { callId }, replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/review/$callId/summary"
              params={{ callId }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← 返回摘要
            </Link>
            <span className="text-sm font-medium">{call.jobTitle}</span>
            <span className="text-xs text-muted-foreground">{call.hrId}</span>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-muted-foreground">
              总进度 <strong className="text-foreground">{done}/{total}</strong>
            </span>
            <span className="text-destructive">
              高价值 <strong>{highDone}/{highTotal}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        {call.entries.map((e) => (
          <EntryCard key={e.entryId} callId={callId} entry={e} onOpenMarkBad={setActiveEntry} />
        ))}
      </div>

      {/* Global Submit Bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <div className="text-xs text-muted-foreground">
            高价值覆盖率: {highTotal === 0 ? '—' : `${Math.round((highDone / highTotal) * 100)}%`}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? '提交中...' : '全局提交'}
          </button>
        </div>
      </div>

      {activeEntry && (
        <MarkBadModal
          callId={callId}
          entry={call.entries.find((e) => e.entryId === activeEntry.entryId)!}
          onClose={() => setActiveEntry(null)}
        />
      )}

      {alertC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card p-5 shadow-2xl">
            <p className="text-sm">还有未标记的高价值条目,是否返回补充</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setAlertC(false)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                是
              </button>
              <button
                onClick={async () => {
                  setAlertC(false);
                  await doSubmit();
                }}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                否,强制提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
