import { createFileRoute, Link } from '@tanstack/react-router';
import { SCENARIO_META } from '../lib/mockData';
import { useReviewStore } from '../store/reviewStore';

export const Route = createFileRoute('/')({
  component: Hub,
  head: () => ({
    meta: [
      { title: 'AI 分身被调用行为 Review' },
      { name: 'description', content: 'AI 分身被调用行为 Review 原型 - 4 组场景演示' },
    ],
  }),
});

function Hub() {
  const reset = useReviewStore((s) => s.resetScenario);
  const statuses = useReviewStore((s) => s.statuses);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-12">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">
            AI Agent Review · Prototype
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            AI 分身被调用行为 Review
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            HR 初轮应答完成后,在限时 Review 通道内对 AI 分身的逐条应答进行评估,生成 Memory 学习单元。
            选择下方任一场景开始演示。
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {SCENARIO_META.map((s) => (
            <div
              key={s.id}
              className="group rounded-xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{s.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                  {statuses[s.id] && (
                    <span className="mt-3 inline-block rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                      当前状态: {statuses[s.id]}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Link
                  to="/review/$callId/summary"
                  params={{ callId: s.id }}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  进入摘要
                </Link>
                <button
                  onClick={() => reset(s.id)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  重置该场景
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          数据通过 Zustand + localStorage 按 callId 持久化。终态(done / auto_timeout / user_close)不可逆。
        </p>
      </div>
    </div>
  );
}
