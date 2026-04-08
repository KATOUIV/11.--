# Vault LLM 交互流程与《前端项目改造指南》对照

权威说明见仓库外文档：

`d:\128.silly\酒馆资料\4.自收集【类脑】\11-2.写卡资料【核心】\6-1终极改造\# 前端项目改造指南.md`（**步骤 3：统一请求处理器** 等）。

本文件说明 Vault 实现与指南的对应关系及**有意差异**。

## 玩家点「发送」时实际发生什么（伪原生 / 不刷主聊天）

Vault 输入框**不会**调用酒馆 `/send`、`/trigger` 等会带动主界面楼层流式刷新的路径；而是调用 `util/vaultTurnPipeline.ts` 的 `runVaultTurn`，按下面 7 步手工仿制「user 楼 → 生成 → assistant 楼」：

1. **构建提示词**：`buildSystemInject(statSnapshot)` 注入为 `generate` 的 `injects`，玩家文本为 `user_input` / user 楼正文。
2. **`createChatMessages`（user，`refresh: 'none'`）**：在聊天中插入 user 楼层，带 **伪0层合并后的** `data`（见下），不触发生成、不刷新酒馆 DOM。
3. **`generate`**：`should_silence: true`，可选 `should_stream` + 流式事件。
4. **清洗与抽取**：去推理块，校验 `<maintext>` 等；流式时向界面推 `VAULT_OS_STREAM_MAINTEXT`。
5. **`Mvu.parseMessage`**：用合并后的 MVU 作 `old_data`，得到本楼 `finalMvu`。
6. **`setChatMessages` / `createChatMessages`（assistant，`refresh: 'none'`）** + **`Mvu.replaceMvuData`**。
7. **`eventEmit(VAULT_OS_TURN_COMMITTED)`**：`VaultApp` 里再 `reloadAndRenderChatWithoutEvents` + `syncMaintextFromChat`，只更新需要部分。

### 伪0层（`message_id: 0`）

`getBaseMvuDataForUserTurn()` 会读取 **`Mvu.getMvuData({ message_id: 0 })`** 与 **`'latest'`**，用 `lodash/merge` 合并（后者覆盖同键），再作为本回合 user 楼 `data` 与 `parseMessage` 的基准。这样开局写在 0 楼的变量会带进后续回合，同时保留最新楼状态。

## 指南步骤 → Vault 实现

| 指南（步骤 3 伪代码） | Vault |
| --- | --- |
| 禁用选项 / 显示生成中 | `VaultApp`：`isGenerating`、选项 `disabled={isGenerating}` |
| 构建提示词 | `buildSystemInject` + `injects`；用户可见句为 `displayUserText` |
| 获取基础 MVU | `getBaseMvuDataForUserTurn()`：`message_id: 0` 与 `'latest'` **深合并**（伪0层 + 最新楼） |
| `createChatMessages(user, data)` | `createChatMessages(..., { refresh: 'none' })` |
| `userMessageId = getLastMessageId()` | 同 |
| `generate` **之前**注册 `STREAM_TOKEN_RECEIVED_FULLY` | `runVaultTurn`：`shouldStream === true` 时注册，**`generate` 的 `finally` 中 `stop()`**（指南示例未写卸载，此处按酒馆助手约定补齐） |
| `generate({ should_stream: true })` | `generate({ should_stream: shouldStream, should_silence: true, injects })`；默认 `shouldStream: false`，设置项 **LLM 流式传输** 打开时与指南一致 |
| 移除 thinking、校验规范 | `stripReasoningBlocks` + `validateAssistantBody`（要求能解析出有效 `<maintext>`） |
| 双 API / 重组标签 | Vault：**不**按指南手动拼接 `<maintext>` 块；主 API 直接产出全文，多 API 模式下再 `generateRaw` 追加变量段 |
| `Mvu.parseMessage` | 同，`klona(mvuBefore)` 作旧数据 |
| `createChatMessages(assistant)` | **酒馆行为**：若 `generate` 已插入一条 assistant 楼层，则对该 id **`setChatMessages`**；否则 **`createChatMessages(assistant)`**。指南示例只写了后者，Vault 兼容「静默生成已占位 assistant」的情况 |
| `Mvu.replaceMvuData` | 同，`message_id: assistantId` |
| 编年史 `checkAndUpdateChronicle` | `util/chronicleWorldbook.ts` 的 `syncChronicleOnAssistantMessage`；由 `tavern_events.MESSAGE_RECEIVED` / `MESSAGE_UPDATED` 以及 `VAULT_OS_TURN_COMMITTED` 回调触发（可能短时重复调用同一 messageId，逻辑幂等） |
| 刷新剧情 UI | `eventEmit(VAULT_OS_TURN_COMMITTED)` → `builtin.reloadAndRenderChatWithoutEvents` + `syncMaintextFromChat` / `syncStatDataFromChat` |
| 流式正文预览 | `removeThinkingTagsFromStream` + 正则提取 `<maintext>…`；`eventEmit(VAULT_OS_STREAM_MAINTEXT, preview)` → `VaultApp` `displayMaintext` |

## 相关文件

- `util/vaultTurnPipeline.ts`：`runVaultTurn`
- `util/messageParser.ts`：`stripReasoningBlocks`、`removeThinkingTagsFromStream`、`loadFromLatestMessage` 等
- `util/vaultSettings.ts`：`streamLlm`
- `util/chronicleWorldbook.ts`：编年史
