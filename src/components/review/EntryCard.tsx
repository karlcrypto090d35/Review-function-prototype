import { useRef } from 'react';
import type { Entry, ReviewDraft } from '../../lib/types';
import { useReviewStore } from '../../store/reviewStore';
import { BAD_TYPE_LABEL } from '../../lib/types';

interface Props {
  callId: string;
  entry: Entry;
  readonly?: boolean;
  onOpenMarkBad: (entry: Entry) => void;
}

export function EntryCard({ callId, entry, readonly, onOpenMarkBad }: Props) {
  const saveDraft = useReviewStore((s) => s.saveDraft);
  const lastClick = useRef(0);
  const d = entry.reviewDraft;

  const debounced = (fn: () => void) => {
    const now = Date.now();
    if (now - lastClick.current < 300) return;
    lastClick.current = now;
    fn();
  };

  const setDraft = (next: ReviewDraft) => {
    saveDraft(callId, entry.entryId, next);
  };

  const onGood = () =>
    debounced(() => {
      if (d.currentMark === 'good') {
        // toggle off
        setDraft({ ...d, currentMark: null, isBadCompleted: false });
      } else {
        setDraft({ ...d, currentMark: 'good', isBadCompleted: false });
      }
    });

  const onBad = () =>
    debounced(() => {
      if (d.currentMark === 'bad') {
        // toggle off, keep history
        setDraft({ ...d, currentMark: null, isBadCompleted: false });
      } else {
        // open modal: set bad-unfinished first
        setDraft({ ...d, currentMark: 'bad', isBadCompleted: false });
        onOpenMarkBad(entry);
      }
    });

  const goodActive = d.currentMark === 'good';
  const badActive = d.currentMark === 'bad';

  // readonly view (terminal states)
  const renderReadOnlyResult = () => {
    if (!entry.markResult) return null;
    if (entry.markResult.type === 'good') {
      return (
        <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-success/10 px-3 py-1.5 text-sm text-success">
          ✓ 已标记: 好
        </div>
      );
    }
    return (
      <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <div className="text-destructive">
          ✗ 已标记: 不好 · {BAD_TYPE_LABEL[entry.markResult.badType]}
        </div>
        <div className="mt-2 whitespace-pre-wrap text-foreground">
          期望应答: {entry.markResult.expectedAnswer}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm transition">
      <div className="flex items-start gap-2">
        {entry.valueRating === 'high' && (
          <span
            title="高价值条目"
            className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground"
          >
            !
          </span>
        )}
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">HR 问题</div>
          <div className="mt-1 font-medium">{entry.hrQuestion}</div>

          <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
            分身应答
          </div>
          <div className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {entry.agentAnswer}
          </div>

          {entry.hrSingleComment !== null && (
            <>
              <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
                HR 单条评论
              </div>
              <div className="mt-1 rounded-md border-l-2 border-warning bg-warning/5 p-3 text-sm">
                {entry.hrSingleComment}
              </div>
            </>
          )}

          {readonly ? (
            renderReadOnlyResult()
          ) : (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={onGood}
                  className={
                    'rounded-md border px-4 py-1.5 text-sm font-medium transition ' +
                    (goodActive
                      ? 'border-success bg-success text-success-foreground'
                      : 'border-border bg-background hover:border-success/50')
                  }
                >
                  好
                </button>
                <button
                  onClick={onBad}
                  className={
                    'rounded-md border px-4 py-1.5 text-sm font-medium transition ' +
                    (badActive
                      ? 'border-destructive bg-destructive text-destructive-foreground'
                      : 'border-border bg-background hover:border-destructive/50')
                  }
                >
                  不好
                </button>
              </div>

              {badActive && !d.isBadCompleted && (
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">待补充期望应答</span>
                  <button
                    onClick={() => onOpenMarkBad(entry)}
                    className="text-primary hover:underline"
                  >
                    继续填写 →
                  </button>
                </div>
              )}

              {badActive && d.isBadCompleted && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <div className="mb-1 text-xs text-destructive">
                    {d.badTypeDraft && BAD_TYPE_LABEL[d.badTypeDraft]} · 期望应答
                  </div>
                  <div className="whitespace-pre-wrap text-foreground">
                    {d.expectedAnswerDraft}
                  </div>
                  <button
                    onClick={() => onOpenMarkBad(entry)}
                    className="mt-2 text-primary hover:underline"
                  >
                    修改期望应答
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
