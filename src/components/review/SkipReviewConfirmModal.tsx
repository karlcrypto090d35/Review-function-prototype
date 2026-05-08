import { useState } from 'react';
import { apiCloseReview } from '../../lib/mockApi';

interface Props {
  callId: string;
  onClose: () => void;
}

const PHRASE = '我确认无需Review';

export function SkipReviewConfirmModal({ callId, onClose }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const enabled = text.trim() === PHRASE;

  const onConfirm = async () => {
    if (!enabled) return;
    setLoading(true);
    await apiCloseReview(callId);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-2xl">
        <h3 className="text-base font-semibold">确认跳过本次 Review</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          一旦关闭,本次 Review 通道将不可逆地终止,Memory 不会更新。
          请在下方输入框中手动键入「{PHRASE}」以确认。
        </p>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          placeholder={PHRASE}
          className="mt-4 w-full rounded-md border bg-background p-2 text-sm focus:border-primary focus:outline-none"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!enabled || loading}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground disabled:opacity-40"
          >
            {loading ? '处理中...' : '确认关闭'}
          </button>
        </div>
      </div>
    </div>
  );
}
