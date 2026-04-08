/**
 * ## 你需要做什么？（反全知已经写在 JSON 里了，不跑脚本也有）
 *
 * - **反全知常驻条**已经插在 `神探夏洛克1-5.json` 的条目 **13**（comment：`雾都 · 叙事边界（反全知·常驻）`），
 *   并且已在 `神探夏洛克·全书·合并.json` 里（同一内容、合并后仍是条目 13）。
 * - 在酒馆里：**绑定世界书后，确认该条目启用**（与其它常驻条一样，常开即可）。无需为了反全知单独跑脚本。
 *
 * ## 什么时候才要跑这个脚本？
 *
 * 只有在你**改动了下面任意一个源文件**之后，想**重新生成**合并本时，在项目根目录执行：
 *   `node src/Sherlock/世界书/merge-sherlock-worldbooks.mjs`
 *
 * - 若 `1-5` 里**还没有**反全知条目，脚本会**自动补上**；
 * - 若**已经有了**，脚本会**跳过重复追加**，但仍会**按当前三本源文件重新写出** `神探夏洛克·全书·合并.json`。
 *
 * 改动的源文件指：`神探夏洛克1-5.json`、`神探夏洛克 角色传记.json`、`《神探夏洛克：编年史·全卷》.json`。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = __dirname;

const ANTI_META_COMMENT = '雾都 · 叙事边界（反全知·常驻）';
const ANTI_META_CONTENT = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【${ANTI_META_COMMENT}】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**视角**：你只掌握故事中人物此刻**合情理**能知道的事。禁止以「方便叙事」替角色或 {{user}} 说出尚未发生的未来、未解锁的卷宗结论、未在场的目击、未交换过的情报。

**禁止剧透式推进**：不得在正文里提前写出尚未成立的推理结果、尚未触发的案件收束、尚未到达的日期节点上的事件，仿佛角色已经读过编年或全案大纲。

**禁止替玩家决定**：不得预设 {{user}} 已同意、已看见、已听懂某物；重大选择处须留白，让玩家通过选项或自述表态。

**与编年/档案条目**：仅当对话上下文已出现合理时间与场景锚点、且按你们既有规则该档案视为激活时，才可调用其中信息；未激活时保持沉默，不以「摘要口吻」向读者解释后事。

**与界面无关**：勿在叙事中提及「玩家」「界面」「按钮」「百分比条」「世界书条目名」等第四面墙用语；保持维多利亚式或当代沉浸口吻。`;

function addAntiMetaEntry(entries) {
  if (Object.keys(entries).some(k => entries[k]?.comment === ANTI_META_COMMENT)) {
    console.info('anti-meta entry already present, skip');
    return entries;
  }
  const template = entries['12'];
  if (!template) {
    throw new Error('template entry 12 missing');
  }
  const nextKey = String(
    Math.max(...Object.keys(entries).map(k => Number.parseInt(k, 10)), -1) + 1,
  );
  const neo = structuredClone(template);
  neo.uid = Number(nextKey);
  neo.displayIndex = Number(nextKey);
  neo.comment = ANTI_META_COMMENT;
  neo.content = ANTI_META_CONTENT;
  neo.order = 99;
  neo.constant = true;
  entries[nextKey] = neo;
  console.info('appended entry', nextKey, ANTI_META_COMMENT);
  return entries;
}

function loadBook(fname) {
  const p = path.join(dir, fname);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.entries || typeof j.entries !== 'object') {
    throw new Error(`${fname}: missing entries`);
  }
  return j.entries;
}

function mergeOrdered(parts) {
  let idx = 0;
  const out = {};
  for (const entries of parts) {
    const keys = Object.keys(entries).sort((a, b) => Number(a) - Number(b));
    for (const k of keys) {
      const e = structuredClone(entries[k]);
      e.uid = idx;
      e.displayIndex = idx;
      out[String(idx)] = e;
      idx += 1;
    }
  }
  return { entries: out };
}

const p15 = path.join(dir, '神探夏洛克1-5.json');
const j15 = JSON.parse(fs.readFileSync(p15, 'utf8'));
j15.entries = addAntiMetaEntry(j15.entries);
fs.writeFileSync(p15, JSON.stringify(j15));
console.info('updated', path.basename(p15));

const merged = mergeOrdered([
  j15.entries,
  loadBook('神探夏洛克 角色传记.json'),
  loadBook('《神探夏洛克：编年史·全卷》.json'),
]);

const outPath = path.join(dir, '神探夏洛克·全书·合并.json');
fs.writeFileSync(outPath, JSON.stringify(merged));
console.info('wrote', path.basename(outPath), 'entries:', Object.keys(merged.entries).length);
