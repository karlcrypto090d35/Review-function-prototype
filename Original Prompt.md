
## 🎯 Prompt：生成 AI 分身被调用行为 Review 功能原型

### 1. 项目概述 (Project Overview)
构建一个名为 **“AI 分身被调用行为 Review”** 的求职者端功能。当 AI 分身（AI Agent）代替用户完成一轮 HR 初步应答后，系统向求职者开放一个限时 Review 通道。求职者通过该界面对 AI 的逐条应答进行审阅：标记“好”进行正向强化，或标记“不好”并输入期望应答以生成 AI 学习单元（Memory Update）。

**核心原则**：
- 用户是评估者而非训练工程师。
- 所有 Memory 更新必须在用户显式全局提交后触发。
- 信息呈现遵循“完整但最小化”。
- Review 终态一旦达成不可逆。
- AI 辅助模块只能提供参考内容，不能自动写入正式输入框。

---

### 2. 核心数据模型 (Core Data Models)
请基于以下 TypeScript-like Schema 构建 Mock Data、状态管理与本地持久化。

**注意**：
- `markResult` 仅代表“最终可提交/已提交结果”。
- 交互过程中的 `bad-unfinished`、切换后隐藏但不能删除的历史输入、以及进度计算，必须通过 `reviewDraft` 表达，不能仅靠 `markResult` 承载。

```typescript
type BadType = 'fact_mismatch' | 'incomplete' | 'style_mismatch';

// 本次调用 (Review Session)
interface Call {
  callId: string;
  jobTitle: string;
  hrId: string;
  startTime: string; // ISO timestamp
  hrOverallComment: string; // 非空
  agentEvaluation?: {
    factualAccuracy: 'normal' | 'abnormal';
    completeness: 'normal' | 'abnormal';
    styleConsistency: 'normal' | 'abnormal';
  }; // 缺失时视为未就绪
  reviewDeadline?: string; // ISO timestamp，缺失时视为未就绪
  reviewStatus: 'pending' | 'done' | 'auto_timeout' | 'user_close';
  entries: Entry[];
}

// 应答条目
interface Entry {
  entryId: string;
  hrQuestion: string;
  agentAnswer: string;
  hrSingleComment: string | null; // null 时完全隐藏且不占位
  valueRating: 'high' | 'low'; // 高价值 / 低价值

  // 最终结果：仅用于终态回放或全局提交后的合法结果
  markResult:
    | null
    | { type: 'good' }
    | {
        type: 'bad';
        badType: BadType;
        expectedAnswer: string;
      };

  // 交互草稿：pending 期间的唯一真实 UI 状态
  reviewDraft: {
    currentMark: null | 'good' | 'bad';
    badTypeDraft: BadType | null;
    expectedAnswerDraft: string; // 允许为空；切换到 good 或 null 时只隐藏，不删除
    isBadCompleted: boolean; // true 才表示“不好·已完成”
  };
}

// Memory Update Payload (全局提交时构建)
interface MemoryPayload {
  callId: string;
  triggerTime: string;
  learningUnits: Array<{
    entryId: string;
    hrQuestion: string;
    agentAnswer: string;
    markResult: Entry['markResult'];
  }>;
}
```

**渲染与提交规则**：
- 在 `reviewStatus === 'pending'` 时，页面渲染、顶部进度、全局提交前检查，一律基于 `reviewDraft` 计算。
- `markResult` 仅用于终态只读展示，或在全局提交成功后回写最终结果。
- `reviewDraft` 的空初始态固定为：

```typescript
{
  currentMark: null,
  badTypeDraft: null,
  expectedAnswerDraft: '',
  isBadCompleted: false
}
```

---

### 3. 页面与视图结构 (App Structure)
使用 React Router 构建多视图原型，包含以下核心视图与覆盖层：

| 视图 | 路径/层级 | 说明 |
|------|-----------|------|
| **Summary Page (模块1)** | `/review/:callId/summary` | 应答结果摘要与决策入口 |
| **Review Detail Page (模块2)** | `/review/:callId/detail` | 逐条审阅主界面，对话流形式 |
| **Skip Review Confirm Modal (覆盖层0)** | Modal Overlay | 主动关闭 Review，要求用户手动输入确认文案 |
| **Mark Bad Modal (覆盖层1)** | Modal Overlay | 输入期望应答、选择不好类型 |
| **Confirm Alert (覆盖层2)** | Alert Overlay | 复用型二次确认（空输入 / 评估不通过 / 高价值未补全） |
| **AI Assist Drawer (模块3)** | Right Side Drawer | 引导式 AI 辅助生成期望应答 |
| **Global Submit Bar** | Fixed Bottom Bar (内嵌于 Detail) | 全局提交与进度展示 |

**Route Guard**：
所有进入 `Summary Page` 或 `Detail Page` 的路由都必须先加载 `Call` 数据并执行守卫：

1. 若 `agentEvaluation` 未就绪、`reviewDeadline` 缺失、或 `callId` 无效，显示“数据准备中，请稍后重试”，不渲染业务页面。
2. 若 `reviewStatus !== 'pending'` 且访问的是 `/review/:callId/detail`，自动重定向到 `/review/:callId/summary` 的只读态。
3. 若当前时间已超过 `reviewDeadline`，必须先执行超时收口逻辑，再进入只读态。

---

### 4. 详细功能与交互规范 (Functional Specs)

#### 4.1 模块1：应答结果摘要 (Summary Page)
- **入口控制**：
  - `Summary Page` 首次渲染时立即执行超时检查。
  - 同一套超时检查还必须在 `Detail Page` 首次渲染、浏览器窗口重新获得焦点、以及用户点击“全局提交”前再次执行。
  - 若未超时：`reviewStatus` 保持 `pending`，“进入 Review”按钮可用。
  - 若超时：`reviewStatus` 变为 `auto_timeout`（终态）。摘要内容保持可见（只读），叠加灰色遮罩提示“Review 通道超时关闭，Memory 无更新”，所有 Review 入口锁定；同时清空该 `callId` 下所有 `reviewDraft` 与模块3历史记录。若用户当前处于 Detail 或任一覆盖层中，应立即关闭覆盖层并回到 Summary 只读态。

- **终态展示规则**：
  - 当 `reviewStatus === 'auto_timeout'`：显示只读摘要 + 灰色遮罩提示“Review 通道超时关闭，Memory 无更新”。
  - 当 `reviewStatus === 'user_close'`：显示只读摘要 + 提示“Review 通道主动关闭，Memory 无更新”。
  - 当 `reviewStatus === 'done'`：显示只读摘要 + 提示“Review 已完成，通道已关闭，Memory 更新日志请跳转分身管理界面查看”。
  - 任一终态下均不渲染可操作 Review 入口。

- **内容区域**：
  - 顶部：岗位名称、HR ID、调用时间、HR 总评、分身行为评估结果（三项子指标）。
  - 高价值条目区：默认展开最多 **3 条**预览卡片（只读，显示 HR 问题 + 分身应答 + HR 单条评论）。若数量 > 3，显示“在 Review 中查看全部 X 条”跳转按钮。若为 0，显示文案“本次应答无需重点 Review 的条目”。
  - 低价值条目区：仅显示文案“共 X 条低价值条目”，**不可展开、不可交互**。

- **操作**：
  - “进入 Review”：携带 `callId` 跳转至 Detail Page，不携带来源标识。
  - **“无需 Review”**：打开 `Skip Review Confirm Modal`。
    - 弹层中包含说明文案、输入框、取消按钮、确认按钮。
    - 用户必须在输入框中**手动键入**“我确认无需Review”，并在 `trim()` 后与该字符串**完全一致**，确认按钮才可点击。
    - 点击确认后，先进入 1s loading，期间禁用该弹层全部操作；待模拟后端写入成功后将 `reviewStatus` 更新为 `user_close`（终态），清空该 `callId` 的所有 `reviewDraft`，提示“Review 通道主动关闭，Memory 无更新”。
    - `user_close` 为终态，不可逆。

---

#### 4.2 模块2：应答结果逐条 Review (Detail Page)
- **布局**：
  - 顶部固定栏：返回摘要按钮（纯导航，不写数据）、岗位/HR 信息、总进度“已完成 X/Y 条”、高价值进度“已完成 X/Y 条高价值条目”。
  - 主体：按时间顺序排列的对话流卡片。**高价值与低价值条目混排，不筛选不分组。**
  - 底部固定栏：全局提交按钮（在 `pending` 状态下始终可点击；真正发起提交后禁用）。

- **单条应答条目卡片 (Entry Card)**：
  - 左上角：若 `valueRating === 'high'`，显示**小尺寸红色感叹号**；低价值条目无任何标识。
  - 内容区（从上到下）：HR 问题、分身应答、HR 单条评论（`null` 时完全隐藏，不显示标题，不保留空白）。
  - **操作区：“好”按钮 | “不好”按钮”**
    - 两个按钮都支持**再次点击以回到未标记 `null` 状态**。
    - **未标记**：两按钮默认态。
    - **点击“好”**：`reviewDraft.currentMark = 'good'`；“好”高亮。再次点击已高亮的“好”按钮时，回到 `null`。
    - **点击“不好”**：系统先立即将条目置为 `currentMark = 'bad'` 且 `isBadCompleted = false`，再直接打开 **覆盖层1 Mark Bad Modal**。
    - **不好类型不在卡片层选择**，只允许在覆盖层1内显式选择。
    - **标记“不好·未完成”**：`currentMark === 'bad' && isBadCompleted === false`；“不好”高亮，卡片下方显示小字“待补充期望应答”与“继续填写”按钮。再次点击已高亮的“不好”按钮时，回到 `null`，但保留历史 `badTypeDraft` 与 `expectedAnswerDraft`。
    - **标记“不好·已完成”**：`currentMark === 'bad' && isBadCompleted === true`；“不好”高亮，卡片下方显示只读的期望应答内容 + “修改期望应答”按钮。再次点击已高亮的“不好”按钮时，回到 `null`，但保留历史 `badTypeDraft` 与 `expectedAnswerDraft`。

- **状态切换规则（草稿连续性，红线）**：
  - 用户可在“好”“不好”“未标记”之间切换。
  - 切换时只改变 `reviewDraft.currentMark` 与 `reviewDraft.isBadCompleted` 的可见状态；**历史 `badTypeDraft` 与 `expectedAnswerDraft` 只能隐藏，不得从数据对象中删除。**
  - 当用户从“好”或“未标记”再次点击“不好”时，打开覆盖层1，并自动预填历史 `badTypeDraft` 与 `expectedAnswerDraft`。
  - 当用户点击“修改期望应答”时，也必须打开覆盖层1，并自动预填历史 `badTypeDraft` 与 `expectedAnswerDraft`。
  - 快速连续点击标记按钮时，仅第一次生效（300ms 防抖）。
  - 在覆盖层1打开期间，底层 Detail 页必须完全不可交互；卡片的“好 / 不好”按钮不可点击。
  - 任意 `currentMark`、`isBadCompleted` 变化后，应立即触发一次草稿保存（同步 mock API + 本地持久化）。

---

#### 4.3 覆盖层1：输入期望应答结果 (Modal)
- **触发**：
  - 在 Detail 页点击“不好”后直接打开；
  - 或点击“修改期望应答”后打开。

- **传入参数**：
  - 条目上下文（HR 问题、分身应答、HR 评论）
  - 预填 `badTypeDraft`
  - 预填 `expectedAnswerDraft`

- **结构**：
  - 顶部：HR 问题、分身应答、HR 评论（`null` 时完全隐藏，不显示标题，不保留空白）。
  - 中部：
    1. **不好类型单选（必填）**：`不符合事实 / 不完整 / 不适配风格`
    2. **期望应答输入框（多行文本）**
  - 底部操作：左侧“AI 辅助输入”按钮 | 右侧“提交”按钮 | 关闭按钮。

- **交互规则**：
  - 不好类型只允许在覆盖层1中选择，卡片层不提供类型选择。
  - 切换不好类型时，不清空已输入的期望应答内容。
  - 打开弹层时，如存在历史 `badTypeDraft` / `expectedAnswerDraft`，必须自动预填。
  - 用户在弹层中的每次输入和类型切换，都应实时写回该条目的 `reviewDraft.badTypeDraft` 和 `reviewDraft.expectedAnswerDraft`，以保证异常关闭、返回摘要、刷新后仍能恢复。
  - 每次草稿变化都应立即触发一次 `POST /api/draft/save`（同步 mock API）并同步写入本地持久化。

- **提交逻辑**：
  - 若未选择不好类型：提交按钮置灰；若仍触发点击，则提示“请选择标记类型”。
  - 若输入框为空：触发 **覆盖层2 状态A**（文案：“没有输入任何内容，是否返回输入”）。
  - 若输入框非空：调用模拟评估模块（同步返回通过/不通过）。
    - **评估通过**：关闭覆盖层1，将条目更新为：
      - `currentMark = 'bad'`
      - `isBadCompleted = true`
      - 保留当前 `badTypeDraft` 与 `expectedAnswerDraft`
    - **评估不通过**：触发 **覆盖层2 状态B**（文案：“当前输入可能影响分身表现，是否修改”）。

- **关闭逻辑**：
  - 用户主动关闭覆盖层1时，不删除任何已输入草稿。
  - 若当前条目处于 `currentMark = 'bad'` 且 `isBadCompleted = false`，关闭后卡片应保留“不好·未完成”状态。

---

#### 4.4 覆盖层2：复用型确认 Alert
`Confirm Alert` 是一个复用型轻量覆盖层，用于三种场景：

1. **状态A：空输入**
2. **状态B：评估不通过**
3. **状态C：高价值条目仍有未标记，提交前确认**

- **文案状态A（空输入）**：
  - 文案：“没有输入任何内容，是否返回输入”
  - “是”：关闭覆盖层2，保留覆盖层1，继续输入。
  - “否”：关闭两层覆盖层，并将该条目回退为 `currentMark = null`、`isBadCompleted = false`；同时清空 `badTypeDraft` 与 `expectedAnswerDraft`，因为本次未形成任何有效草稿。
  - “AI 辅助输入”：关闭覆盖层2，保留覆盖层1，打开模块3。

- **文案状态B（评估不通过）**：
  - 文案：“当前输入可能影响分身表现，是否修改”
  - “是”：关闭覆盖层2，保留覆盖层1与现有输入，继续修改。
  - “否”：关闭两层覆盖层，条目进入 `currentMark = 'bad'` 且 `isBadCompleted = true`，**保留用户原始输入内容存档**。
  - “AI 辅助输入”：关闭覆盖层2，保留覆盖层1，打开模块3。

- **文案状态C（高价值未补全）**：
  - 文案：“还有未标记的高价值条目，是否返回补充”
  - “是”：关闭 Alert，返回 Detail 页当前滚动位置，保留所有已完成标记与草稿，并恢复全局提交按钮可点击状态。
  - “否”：关闭 Alert，允许继续执行全局提交。

- **显示规则**：
  - 同一时间只允许出现一个 Alert。
  - 若模块3打开中，不允许再弹出 Alert；需先关闭模块3后再继续后续判断。

---

#### 4.5 模块3：辅助生成期望应答 (Right Side Drawer)
- **触发**：覆盖层1 或 覆盖层2 中点击“AI 辅助输入”。

- **布局**：
  - 右侧竖排非模态抽屉，叠加在覆盖层1之上。
  - 标题栏“AI 辅助输入”
  - 对话区域（AI 引导问题 / 用户回复 / AI 生成参考内容气泡）
  - 底部用户输入框与发送按钮
  - 右上角关闭按钮

- **核心规则（红线）**：
  1. **模块3只负责生成参考内容，不得以任何形式自动写入、自动覆盖、自动同步到覆盖层1输入框。**
  2. 用户必须手动复制或手动填写到覆盖层1输入框；该手动行为本身构成显式确认。
  3. 模块3激活期间：
     - 覆盖层1输入框保持可编辑；
     - 但覆盖层1的“提交”按钮、关闭按钮、以及不好类型单选均锁定不可点击；
     - 底层 Detail 页继续保持完全不可交互。
  4. 模块3关闭后，覆盖层1恢复正常交互。
  5. 生命周期：模块3历史记录仅在当前覆盖层1存活期间保留；覆盖层1关闭时，模块3历史记录同步清除，不做持久化。

- **对话逻辑**：
  - 使用 System Prompt 模拟引导式问答，逐步收集上下文后，最终输出一段“可供用户参考的期望应答文本”。
  - 最终参考文本需提供“复制”按钮，但复制行为不等于自动填入。

- **埋点**：
  - 打开模块3时记录一次 `ai_assist_open`
  - 若用户在模块3打开后最终完成该条“不好”标记，记录 `ai_assist_convert = true`

---

#### 4.6 模块4：Review 结果确认 (Global Submit)
- **触发**：点击 Detail 页底部“全局提交”按钮。

- **完成定义**：
  - 条目满足以下任一条件，才计为“已完成”：
    1. `reviewDraft.currentMark === 'good'`
    2. `reviewDraft.currentMark === 'bad' && reviewDraft.isBadCompleted === true`
  - `currentMark === null` 或 `bad-unfinished` 均不计入已完成。

- **提交前检查**：
  1. 再次执行一次超时检查。若已超时，则立即转为 `auto_timeout` 终态并退出提交流程。
  2. 遍历所有 `valueRating === 'high'` 的条目，检查其是否已完成。
  3. 若存在未完成的高价值条目：弹出 **覆盖层2 状态C**。
     - “是”：返回 Detail 页，保留所有已完成标记与草稿。
     - “否”：允许用户强制提交，进入 Memory 更新流程。
  4. 若检查通过：直接进入提交流程。

- **提交动作**：
  - 按钮首次点击后立即禁用（防重复提交 / 幂等）。
  - `MemoryPayload` 必须**基于 `reviewDraft` 动态计算生成**，而不是直接读取旧的 `markResult`。
  - 仅包含“已完成”的条目，未完成条目自动剔除。
  - 生成规则：
    - 若 `currentMark === 'good'`，生成：

```typescript
{ type: 'good' }
```

  - 若 `currentMark === 'bad' && isBadCompleted === true`，生成：

```typescript
{
  type: 'bad',
  badType: badTypeDraft,
  expectedAnswer: expectedAnswerDraft
}
```

- **合法性约束**：
  - 标记“好”的条目不得带 `badType` 或 `expectedAnswer`。
  - 标记“不好”的条目必须同时具备非空 `badTypeDraft` 与非空 `expectedAnswerDraft.trim()`。
  - 绝不允许出现非法组合。
  - 提交前可先在控制台打印 `MemoryPayload` 以便演示校验。

- **提交成功后的状态变更**：
  - 模拟后端写入 `reviewStatus = 'done'`（需 1.5s 网络延迟）。
  - 写入成功后：
    1. 将每个“已完成”条目的最终结果回写到 `markResult`
    2. 清除该 `callId` 下的全部 `reviewDraft`
    3. 清除该 `callId` 下的模块3历史记录
    4. 自动跳转到 `/review/:callId/summary` 的只读态
    5. 立即显示完成提示“Review 已完成，通道已关闭，Memory 更新日志请跳转分身管理界面查看”
  - **此提示不等待 Memory 更新异步任务返回**，两者必须解耦。
  - `reviewStatus = 'done'` 为终态，不可逆。

---

#### 4.7 草稿与重访 (Draft & Revisit)
- 用户在 Detail 页完成部分标记后，点击“返回摘要”或退出页面：在 `reviewStatus === 'pending'` 且未超时期间，草稿（`reviewDraft`）必须跨会话完整保留。
- **持久化机制**：使用 `Zustand persist + localStorage` 持久化，以 `callId` 作为隔离 key。
- 初始化页面时：
  1. 先加载 mock base data；
  2. 再叠加 localStorage 中该 `callId` 的 `reviewDraft` 与 `reviewStatus`；
  3. 若二者冲突，以终态 `reviewStatus` 优先。
- 用户从 Summary 再次进入 Detail 时，恢复草稿状态，从对话流顶部开始显示，不自动滚动。
- 用户刷新页面后：
  - 若仍处于 `pending` 且未超时，应恢复草稿；
  - 若已进入任一终态，应保持终态，不可恢复为 `pending`。
- 当 Review 通道关闭（`done` / `auto_timeout` / `user_close` 任一终态）时：
  - 清除该 `callId` 的所有 `reviewDraft`
  - 清除该 `callId` 的模块3历史记录
  - 但保留终态 `reviewStatus`，以确保刷新后仍为终态

---

### 5. 状态机摘要 (State Machines)

**Review 通道状态（终态不可逆）**：  
`pending` → `done`（全局提交成功）  
`pending` → `auto_timeout`（任一时点超时检查失败）  
`pending` → `user_close`（主动跳过并确认）

**条目草稿状态（基于 reviewDraft）**：  
`null` ↔ `good`  
`null` ↔ `bad-unfinished` → `bad-completed`  
`good` ↔ `bad-unfinished` → `bad-completed`  
`bad-completed` ↔ `good`  
`bad-completed` ↔ `null`

**状态解释**：
- `null`：`currentMark === null`
- `good`：`currentMark === 'good'`
- `bad-unfinished`：`currentMark === 'bad' && isBadCompleted === false`
- `bad-completed`：`currentMark === 'bad' && isBadCompleted === true`

**红线**：
- 从任一状态切换离开时，历史 `badTypeDraft` 与 `expectedAnswerDraft` 只能隐藏，不能自动删除。
- 仅在覆盖层2状态A中，用户选择“否”放弃空输入时，允许清空本次未形成有效草稿的 bad draft。

---

### 6. UI/UX 红线与约束 (Red Lines)
1. **HR 单条评论为 `null`**：在所有位置（Summary 卡片、Detail 卡片、覆盖层1）不渲染评论模块、不显示评论标题、不保留空白占位；其余内容自然上移。
2. **终态不可逆**：`done` / `auto_timeout` / `user_close` 达成后，页面不得渲染任何可操作 Review 入口；浏览器返回或刷新后仍保持终态，不可恢复为 `pending`。
3. **终态路由保护**：若 `reviewStatus !== 'pending'`，则不得进入或停留在 `/review/:callId/detail`；直接访问该路由时，必须自动跳转至 `/review/:callId/summary` 的只读态。
4. **Modal 锁定**：覆盖层1（Mark Bad Modal）打开期间，底层 Detail 页必须完全阻断交互（滚动、按钮、背景层）。
5. **异步独立**：`POST /api/review/submit` 成功并将 `reviewStatus` 写为 `done` 后，即视为 Review 通道已完成。其后的 Memory 更新异步任务即使失败，也不得回滚 `done`，不弹出用户可见错误，仅允许在开发者工具栏或控制台中模拟和观察。
6. **降级安全态**：若进入 Summary 或 Detail 时评估结果未就绪、截止时间字段缺失、或 `callId` 无效，页面不渲染业务内容，显示“数据准备中，请稍后重试”并锁定入口。
7. **提交幂等性**：全局提交按钮在发起提交后立即禁用；只有在用户被 Alert 状态C拦截并选择“是”返回补充时才恢复可点击。若已真正进入 `/api/review/submit` 请求，则按钮不得再次启用。
8. **AI 辅助红线**：模块3生成的任何文本都不得自动带入正式提交链路，必须经过用户手动复制/填写后才可提交。

---

### 7. 原型数据要求 (Mock Data Scenarios)
请预置以下 4 组 Mock Data，支持通过导航或切换按钮演示：

| 场景 | 状态 | 用途 |
|------|------|------|
| **A. 正常待审** | `pending`，含 4 条高价值、6 条低价值；其中 1 条高价值 `hrSingleComment = null`；全部 `reviewDraft` 为空 | 演示主路径、高价值展开规则、null 评论处理 |
| **B. 存在草稿** | `pending`；用户已标记 2 条 `good`、1 条 `bad-completed`、1 条 `bad-unfinished`；其中至少 1 条曾从 `bad` 切到 `good` 但保留历史 `expectedAnswerDraft` | 演示草稿恢复、进度计算、修改预填、隐藏不删除 |
| **C. 超时关闭** | 初始数据为 `pending`，但 `reviewDeadline < now`，页面加载后自动收口为 `auto_timeout` | 演示 Summary / Detail 超时检查、终态锁定、草稿清除 |
| **D. 已完成** | `done`，含合法 `markResult` 回放数据，`reviewDraft` 已清空 | 演示终态不可逆、摘要只读、完成提示 |

**Mock Data 约束**：
- 每个场景都必须有唯一 `callId`。
- 场景 A / B / C 中，条目的用户状态应主要由 `reviewDraft` 表达；`markResult` 可保持为 `null`。
- 场景 B 必须能验证：
  1. 从 `good` 切回 `bad` 时自动预填历史内容；
  2. `bad-unfinished` 不计入完成数；
  3. 刷新页面后草稿仍在。
- 场景 C 必须验证：Summary 与 Detail 两个入口都会触发超时收口。
- 场景 D 中 `markResult` 必须全部合法，且 `reviewDraft` 为空。

---

### 8. 需要模拟的 API 行为 (Simulated APIs)
- `GET /api/call/:callId`
  - 返回 `Call` 数据，含条目、评估结果、终态状态。
  - 若 `agentEvaluation` 或 `reviewDeadline` 缺失，则前端进入“数据准备中，请稍后重试”。

- `POST /api/draft/save`
  - 入参：`callId + entryId + reviewDraft`
  - 同步立即响应；用于模拟单条草稿保存。
  - 即使使用 localStorage 持久化，仍保留此 mock API 以演示保存动作。

- `POST /api/evaluate`
  - 入参：`badType + expectedAnswer + entryContext`
  - 同步返回：

```typescript
{ result: 'pass' | 'fail' }
```

  - 默认按规则模拟，另允许开发者工具栏强制“下一次必过 / 下一次必不通过”。

- `POST /api/review/submit`
  - 入参：`MemoryPayload`
  - 模拟 1.5s 延迟，返回 200，并将 `reviewStatus` 写为 `done`。

- `POST /api/review/close`
  - 入参：`callId`
  - 模拟 1s 延迟，返回 200，并将 `reviewStatus` 写为 `user_close`。

- `POST /api/ai-assist`
  - 入参：当前条目上下文 + 用户补充输入
  - 返回流式或逐条对话消息，最终产出一段参考文本。

- `POST /api/memory-job`（仅开发模拟）
  - 用于模拟 `done` 后的异步 Memory 更新任务。
  - 其成功或失败都**不影响** `reviewStatus = done` 的最终状态。

---

### 9. 评估指标观测点 (Analytics Observation Points)
在 UI 合适位置预留可视化标签或控制台日志，用于演示以下指标：

- **高价值条目标记覆盖率**：
  - 分子：已完成的高价值条目数
  - 分母：全部高价值条目数
  - 在顶部进度中直观展示。

- **模块3调用率**：
  - 每次打开 AI Assist Drawer 记录一次。

- **模块3有效转化率**：
  - 若某条目打开过模块3，且最终该条目形成 `bad-completed`，则记为一次有效转化。

- **单次 Review 完成时间**：
  - 从用户首次进入 Detail 页开始计时；
  - 在 `reviewStatus` 成功写为 `done` 或 `user_close` 时停止；
  - 可用开发测试浮层展示。

- **质量门控误杀/漏放演示**：
  - 由 `POST /api/evaluate` 的 pass/fail 结果和用户最终选择共同展示。

---

### 10. 实现优先级与消歧规则（务必遵守）
1. 若实现存在冲突，优先级为：
   状态正确性 > 路由守卫 > 终态不可逆 > 草稿持久化 > 提交合法性 > 模态锁定 > 动画 > 视觉美化。
2. 不允许将 `reviewDraft` 与 `markResult` 合并实现；两者必须严格分离。
3. 当条目从 `bad-completed` 或 `bad-unfinished` 切换到 `good` 或 `null` 时：
   - 保留 `badTypeDraft`
   - 保留 `expectedAnswerDraft`
   - 将 `isBadCompleted` 重置为 `false`
   - 再次点击“不好”时，统一先设置为 `currentMark='bad' && isBadCompleted=false`，并打开 Mark Bad Modal。
4. 默认路由 `/` 为 Scenario Hub，展示四组场景 A/B/C/D，点击后进入各自的 `/review/:callId/summary`。
5. 所有界面文案统一使用中文。
6. localStorage 必须按 `callId` 隔离，建议 key 形式为 `ai-review:${callId}`。
7. 若进入终态，刷新后必须保持终态；不得因 mock base data 重新恢复为 `pending`。
8. `POST /api/ai-assist` 请使用固定 mock 消息结构，确保最终一定生成一条“参考期望应答”消息，并为该消息提供复制按钮，但不得自动填入正式输入框。
9. 若某条规则未完全实现，不允许静默忽略；请在开发者工具栏中显示 `Known Gaps`，列出所有简化项或未实现项。
10. 生成代码时优先保证：
   - 所有关键状态切换有明确函数
   - 所有 route guard 可复用
   - 所有 mock API 独立封装
   - 所有终态逻辑集中处理

### 💡 给 Lovable 的额外指令
1. **技术栈**：React + TypeScript + Tailwind CSS + React Router DOM。使用 Zustand 管理全局 Review 状态，并启用 `persist` 做本地持久化。
2. **组件拆分**：将 `EntryCard`、`SummaryCard`、`MarkBadModal`、`SkipReviewConfirmModal`、`ConfirmAlert`、`AIAssistDrawer`、`GlobalSubmitBar` 拆分为独立组件；将路由守卫与超时检查拆成可复用 hooks（如 `useReviewGuard`、`useTimeoutGuard`）。
3. **响应式**：优先桌面端，但需保证移动端抽屉与模态框的触控体验。
4. **动画**：状态切换（标记高亮、模态框出现、抽屉滑入、提示条出现）需有 200-300ms 过渡动画，以体现“状态机”的质感。
5. **边界演示**：在原型角落添加一个“开发者工具栏”，允许手动触发以下事件，方便评审所有异常路径：
   - 切换场景 A / B / C / D
   - 模拟当前会话立即超时
   - 强制下一次 `evaluate` 返回 `fail`
   - 强制下一次 `evaluate` 返回 `pass`
   - 强制清空当前 `callId` 草稿
   - 模拟 `done` 后的 Memory 异步任务失败（仅控制台可见，不影响 UI）
   - 重置当前场景到初始 mock 数据
6. **Definition of Done（验收标准）**：生成结果必须满足以下条件：
   - 四组 Mock Data 均可通过导航切换并独立运行
   - Summary / Detail / Skip Review Confirm Modal / Mark Bad Modal / Confirm Alert / AI Assist Drawer 全链路可交互
   - 草稿在 `pending` 期间刷新后可恢复
   - 终态刷新后不可恢复为 `pending`
   - Global Submit 生成的 `MemoryPayload` 只包含合法 learningUnits
   - AI Assist Drawer 不得自动写入 Mark Bad Modal 输入框
   - 高价值条目未标记时会拦截，但用户仍可强制提交
   - 终态下不得停留在 Detail 页
   - `hrSingleComment = null` 时所有页面都不渲染评论模块

---

**请基于以上 Prompt，生成一个可直接运行、包含全部 Mock Data 与交互路径的高保真可交互原型。**
