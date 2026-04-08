/**
 * 与你在 SillyTavern 中为「神探夏洛克」角色卡配置的世界书一致。
 * 留空字符串则：跳过开局/正常 COT 条目切换、跳过编年史写入（其余 LLM 流程仍工作）。
 */
/** 与你在酒馆中为角色卡绑定的世界书**名称**一致（合并本见 `世界书/神探夏洛克·全书·合并.json`） */
export const SHERLOCK_WORLDBOOK_NAME = '神探夏洛克·全书·合并';

/** 开局阶段启用的世界书条目名（须与世界书中名称一致） */
export const SHERLOCK_ENTRY_OPENING_COT = '开局COT';

/** 正常阶段启用的世界书条目名 */
export const SHERLOCK_ENTRY_COT = 'COT';

/** 接收 &lt;sum&gt; 摘要写入的条目名 */
export const SHERLOCK_ENTRY_CHRONICLE = '编年史';
