import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useReviewGuard } from '../hooks/useReviewGuard';
import { SkipReviewConfirmModal } from '../components/review/SkipReviewConfirmModal';
import { BAD_TYPE_LABEL } from '../lib/types';

function ClientDate({ iso }: { iso: string }) {
  const [text, setText] = useState('');
  useEffect(() => setText(new Date(iso).toLocaleString()), [iso]);
  return <span suppressHydrationWarning>{text}</span>;
}
import { useReviewGuard } from '../hooks/useReviewGuard';
import { SkipReviewConfirmModal } from '../components/review/SkipReviewConfirmModal';
import { BAD_TYPE_LABEL } from '../lib/types';

export const Route = createFileRoute('/review/$callId/summary')({
  component: SummaryPage,
});

function SummaryPage() {
  const { callId } = Route.useParams();
  const { status, call } = useReviewGuard(callId);
  const [skipOpen, setSkipOpen] = useState(false);
  const navigate = useNavigate();

  // ensure terminal display refreshes when status changes
  useEffect(() => {}, [call?.reviewStatus]);

  if (status === 'not_ready') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        数据准备中,请稍后重试
      </div>
    );
  }
  if (!call) return null;

  const highEntries = call.entries.filter((e) => e.valueRating === 'high');
  const lowEntries = call.entries.filter((e) => e.valueRating === 'low');
  const previewHigh = highEntries.slice(0, 3);
  const isTerminal = call.reviewStatus !== 'pending';

  const terminalMsg =
    call.reviewStatus === 'auto_timeout'
      ? 'Review 通道超时关闭,Memory 无更新'
      : call.reviewStatus === 'user_close'
      ? 'Review 通道主动关闭,Memory 无更新'
      : call.reviewStatus === 'done'
      ? 'Review 已完成,通道已关闭,Memory 更新日志请跳转分身管理界面查看'
      : '';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回场景列表
        </Link>

        <header className="mt-4 rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{call.jobTitle}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                HR {call.hrId} · {new Date(call.startTime).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-accent px-2 py-1 text-xs text-accent-foreground">
              {call.reviewStatus}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">HR 总评</div>
            <p className="mt-1 text-sm">{call.hrOverallComment}</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {call.agentEvaluation &&
              (Object.entries(call.agentEvaluation) as [string, 'normal' | 'abnormal'][]).map(
                ([k, v]) => (
                  <div
                    key={k}
                    className={
                      'rounded-md border p-2 text-center ' +
                      (v === 'normal'
                        ? 'border-success/30 bg-success/5 text-success'
                        : 'border-destructive/30 bg-destructive/5 text-destructive')
                    }
                  >
                    <div className="text-[11px] text-muted-foreground">
                      {k === 'factualAccuracy'
                        ? '事实准确性'
                        : k === 'completeness'
                        ? '完整性'
                        : '风格一致性'}
                    </div>
                    <div className="font-medium">{v === 'normal' ? '正常' : '异常'}</div>
                  </div>
                )
              )}
          </div>
        </header>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            高价值条目 ({highEntries.length})
          </h2>
          {highEntries.length === 0 ? (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              本次应答无需重点 Review 的条目
            </p>
          ) : (
            <div className="space-y-3">
              {previewHigh.map((e) => (
                <div key={e.entryId} className="rounded-md border bg-card p-4 text-sm">
                  <div className="font-medium">! {e.hrQuestion}</div>
                  <div className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-foreground">
                    {e.agentAnswer}
                  </div>
                  {e.hrSingleComment !== null && (
                    <div className="mt-2 border-l-2 border-warning pl-2 text-muted-foreground">
                      {e.hrSingleComment}
                    </div>
                  )}
                  {isTerminal && e.markResult && (
                    <div className="mt-2 text-xs">
                      最终: {e.markResult.type === 'good'
                        ? '✓ 好'
                        : `✗ 不好 · ${BAD_TYPE_LABEL[e.markResult.badType]}`}
                    </div>
                  )}
                </div>
              ))}
              {highEntries.length > 3 && !isTerminal && (
                <button
                  onClick={() => navigate({ to: '/review/$callId/detail', params: { callId } })}
                  className="text-sm text-primary hover:underline"
                >
                  在 Review 中查看全部 {highEntries.length} 条 →
                </button>
              )}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            低价值条目
          </h2>
          <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
            共 {lowEntries.length} 条低价值条目
          </p>
        </section>

        {!isTerminal && (
          <div className="mt-8 flex gap-3">
            <Link
              to="/review/$callId/detail"
              params={{ callId }}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              进入 Review
            </Link>
            <button
              onClick={() => setSkipOpen(true)}
              className="rounded-md border px-5 py-2 text-sm hover:bg-muted"
            >
              无需 Review
            </button>
          </div>
        )}

        {isTerminal && (
          <div
            className={
              'mt-8 rounded-md p-4 text-sm ' +
              (call.reviewStatus === 'done'
                ? 'border border-success/30 bg-success/5 text-success'
                : 'border border-muted bg-muted text-muted-foreground')
            }
          >
            {terminalMsg}
          </div>
        )}
      </div>

      {skipOpen && <SkipReviewConfirmModal callId={callId} onClose={() => setSkipOpen(false)} />}
    </div>
  );
}
