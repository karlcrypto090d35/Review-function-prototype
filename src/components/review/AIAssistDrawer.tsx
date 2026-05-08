import { useEffect, useRef, useState } from 'react';
import type { Entry } from '../../lib/types';
import { aiAssistInitialMessages, apiAIAssistReply, type AIMessage } from '../../lib/mockApi';

interface Props {
  entry: Entry;
  onClose: () => void;
}

export function AIAssistDrawer({ entry, onClose }: Props) {
  const [messages, setMessages] = useState<AIMessage[]>(() => aiAssistInitialMessages());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg: AIMessage = { id: `u-${Date.now()}`, role: 'user', text: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setBusy(true);
    const reply = await apiAIAssistReply(next, userMsg.text);
    setMessages([...next, ...reply]);
    setBusy(false);
  };

  const copy = (t: string) => {
    navigator.clipboard?.writeText(t);
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card shadow-2xl"
      style={{ animation: 'slideIn .25s ease-out' }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="font-semibold">AI 辅助输入</h3>
          <p className="text-xs text-muted-foreground">仅生成参考内容,不会自动写入</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
          上下文: {entry.hrQuestion}
        </div>
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              'rounded-lg p-3 text-sm ' +
              (m.role === 'ai'
                ? 'bg-accent text-accent-foreground'
                : 'ml-8 bg-primary text-primary-foreground')
            }
          >
            <div className="whitespace-pre-wrap">{m.text}</div>
            {m.isReference && (
              <button
                onClick={() => copy(m.text)}
                className="mt-2 rounded border border-current/30 px-2 py-0.5 text-xs hover:bg-background/20"
              >
                复制参考文本
              </button>
            )}
          </div>
        ))}
        {busy && <div className="text-xs text-muted-foreground">AI 正在思考...</div>}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="补充信息..."
            className="flex-1 resize-none rounded-md border bg-background p-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || busy}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
          >
            发送
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          注:模块3生成的内容不会自动同步到正式输入框,请手动复制或自行填写。
        </p>
      </div>

      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}
