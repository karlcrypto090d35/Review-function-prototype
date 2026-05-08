import { useEffect, useState } from 'react';
import type { BadType, Entry } from '../../lib/types';
import { BAD_TYPE_LABEL } from '../../lib/types';
import { useReviewStore } from '../../store/reviewStore';
import { apiEvaluate } from '../../lib/mockApi';
import { AIAssistDrawer } from './AIAssistDrawer';

export type AlertState =
  | { kind: 'A' } // empty input
  | { kind: 'B' } // evaluate fail
  | null;

interface Props {
  callId: string;
  entry: Entry;
  onClose: () => void;
}

export function MarkBadModal({ callId, entry, onClose }: Props) {
  const saveDraft = useReviewStore((s) => s.saveDraft);
  const recordAIOpen = useReviewStore((s) => s.recordAIOpen);

  const [badType, setBadType] = useState<BadType | null>(entry.reviewDraft.badTypeDraft);
  const [text, setText] = useState<string>(entry.reviewDraft.expectedAnswerDraft);
  const [alert, setAlert] = useState<AlertState>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // live save draft
  useEffect(() => {
    saveDraft(callId, entry.entryId, {
      currentMark: 'bad',
      badTypeDraft: badType,
      expectedAnswerDraft: text,
      isBadCompleted: entry.reviewDraft.isBadCompleted,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badType, text]);

  const closeAndKeepDraft = () => onClose();

  const handleSubmit = async () => {
    if (!badType) return;
    if (!text.trim()) {
      setAlert({ kind: 'A' });
      return;
    }
    setSubmitting(true);
    const { result } = await apiEvaluate(badType, text);
    setSubmitting(false);
    if (result === 'pass') {
      saveDraft(callId, entry.entryId, {
        currentMark: 'bad',
        badTypeDraft: badType,
        expectedAnswerDraft: text,
        isBadCompleted: true,
      });
      onClose();
    } else {
      setAlert({ kind: 'B' });
    }
  };

  // alert handlers
  const onAlertYes = () => {
    if (alert?.kind === 'A') setAlert(null);
    else if (alert?.kind === 'B') setAlert(null);
  };
  const onAlertNo = () => {
    if (alert?.kind === 'A') {
      // discard this empty draft entirely
      saveDraft(callId, entry.entryId, {
        currentMark: null,
        badTypeDraft: null,
        expectedAnswerDraft: '',
        isBadCompleted: false,
      });
      setAlert(null);
      onClose();
    } else if (alert?.kind === 'B') {
      // keep raw input, mark complete
      saveDraft(callId, entry.entryId, {
        currentMark: 'bad',
        badTypeDraft: badType,
        expectedAnswerDraft: text,
        isBadCompleted: true,
      });
      setAlert(null);
      onClose();
    }
  };
  const onAlertAI = () => {
    setAlert(null);
    setDrawerOpen(true);
    recordAIOpen(entry.entryId);
  };

  const lockedByDrawer = drawerOpen;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-base font-semibold">输入期望应答结果</h3>
          <button
            disabled={lockedByDrawer || submitting}
            onClick={closeAndKeepDraft}
            className="text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-md bg-muted p-3 text-sm">
            <div className="text-xs text-muted-foreground">HR 问题</div>
            <div className="mt-1">{entry.hrQuestion}</div>
            <div className="mt-3 text-xs text-muted-foreground">分身应答</div>
            <div className="mt-1 whitespace-pre-wrap">{entry.agentAnswer}</div>
            {entry.hrSingleComment !== null && (
              <>
                <div className="mt-3 text-xs text-muted-foreground">HR 评论</div>
                <div className="mt-1">{entry.hrSingleComment}</div>
              </>
            )}
          </section>

          <div>
            <div className="mb-2 text-sm font-medium">不好类型 (必填)</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BAD_TYPE_LABEL) as BadType[]).map((bt) => (
                <button
                  key={bt}
                  disabled={lockedByDrawer}
                  onClick={() => setBadType(bt)}
                  className={
                    'rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-50 ' +
                    (badType === bt
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/40')
                  }
                >
                  {BAD_TYPE_LABEL[bt]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">期望应答</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="请输入你期望 AI 分身做出的应答..."
              className="w-full resize-none rounded-md border bg-background p-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3">
          <button
            onClick={() => {
              setDrawerOpen(true);
              recordAIOpen(entry.entryId);
            }}
            disabled={lockedByDrawer}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            AI 辅助输入
          </button>
          <button
            onClick={handleSubmit}
            disabled={!badType || lockedByDrawer || submitting}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? '校验中...' : '提交'}
          </button>
        </div>

        {/* Alert overlay */}
        {alert && !drawerOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-sm rounded-lg bg-card p-5 shadow-xl">
              <p className="text-sm">
                {alert.kind === 'A'
                  ? '没有输入任何内容,是否返回输入'
                  : '当前输入可能影响分身表现,是否修改'}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={onAlertYes}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                >
                  是
                </button>
                <button
                  onClick={onAlertNo}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  否
                </button>
                <button
                  onClick={onAlertAI}
                  className="text-sm text-primary hover:underline"
                >
                  AI 辅助输入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {drawerOpen && (
        <AIAssistDrawer
          entry={entry}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
