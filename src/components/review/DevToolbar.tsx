import { useState } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useReviewStore } from '../../store/reviewStore';
import { SCENARIO_META } from '../../lib/mockData';

export function DevToolbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();
  const setForceEvaluate = useReviewStore((s) => s.setForceEvaluate);
  const setForceTimeout = useReviewStore((s) => s.setForceTimeout);
  const resetScenario = useReviewStore((s) => s.resetScenario);
  const clearDrafts = useReviewStore((s) => s.clearDrafts);
  const forceEvaluate = useReviewStore((s) => s.forceEvaluate);
  const analytics = useReviewStore((s) => s.analytics);

  // extract callId from path
  const m = loc.pathname.match(/\/review\/([^/]+)/);
  const callId = m?.[1];

  const knownGaps = [
    'Modal 锁定通过 z-index + 背景遮罩实现,未禁用 body 滚动',
    'AI Assist 抽屉为简化实现,非真实流式',
    '高价值条目左上角红色感叹号采用文字 ! 替代 SVG 图标',
  ];

  return (
    <div className="fixed bottom-3 left-3 z-[60] text-xs">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md border bg-card/90 px-3 py-1 shadow-md backdrop-blur hover:bg-card"
        >
          🛠 Dev
        </button>
      ) : (
        <div className="w-72 rounded-lg border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <strong>开发者工具栏</strong>
            <button onClick={() => setOpen(false)} className="text-muted-foreground">
              ✕
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-muted-foreground">切换场景</div>
            <div className="flex flex-wrap gap-1">
              {SCENARIO_META.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    navigate({ to: '/review/$callId/summary', params: { callId: s.id } })
                  }
                  className="rounded border px-2 py-0.5 hover:bg-muted"
                >
                  {s.id.slice(-1)}
                </button>
              ))}
            </div>
          </div>

          {callId && (
            <div className="mt-3 space-y-1">
              <div className="text-muted-foreground">当前 callId: {callId}</div>
              <button
                onClick={() => setForceTimeout(callId)}
                className="block w-full rounded border px-2 py-1 text-left hover:bg-muted"
              >
                模拟立即超时
              </button>
              <button
                onClick={() => clearDrafts(callId)}
                className="block w-full rounded border px-2 py-1 text-left hover:bg-muted"
              >
                清空当前草稿
              </button>
              <button
                onClick={() => {
                  resetScenario(callId);
                  navigate({ to: '/review/$callId/summary', params: { callId } });
                }}
                className="block w-full rounded border px-2 py-1 text-left hover:bg-muted"
              >
                重置该场景
              </button>
            </div>
          )}

          <div className="mt-3 space-y-1">
            <div className="text-muted-foreground">下次 evaluate</div>
            <div className="flex gap-1">
              <button
                onClick={() => setForceEvaluate('pass')}
                className={
                  'flex-1 rounded border px-2 py-1 ' +
                  (forceEvaluate === 'pass' ? 'border-success bg-success/10' : '')
                }
              >
                必过
              </button>
              <button
                onClick={() => setForceEvaluate('fail')}
                className={
                  'flex-1 rounded border px-2 py-1 ' +
                  (forceEvaluate === 'fail' ? 'border-destructive bg-destructive/10' : '')
                }
              >
                必不通过
              </button>
              <button
                onClick={() => setForceEvaluate(null)}
                className="rounded border px-2 py-1"
              >
                清
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <button
              onClick={() => {
                console.warn('[mock] memory-job failed (decoupled, does not affect done state)');
              }}
              className="block w-full rounded border px-2 py-1 text-left hover:bg-muted"
            >
              模拟 Memory 任务失败
            </button>
          </div>

          <div className="mt-3">
            <div className="text-muted-foreground">分析观测</div>
            <div className="mt-1 rounded bg-muted p-2">
              <div>AI 打开次数: {Object.values(analytics.aiAssistOpenByEntry).reduce((a, b) => a + b, 0)}</div>
              <div>有效转化条目: {Object.values(analytics.aiAssistConvert).filter(Boolean).length}</div>
            </div>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-muted-foreground">Known Gaps</summary>
            <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
              {knownGaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
