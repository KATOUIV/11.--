/**
 * 从参考世界书拆分条目并写入：
 * - src/vault/世界书/战斗/*.yaml（供 vault 角色卡 index.yaml「条目」引用，绿灯关键词触发）
 * - assets/worldbook/dnd5e-combat-hud-v1.json（可选：酒馆手动导入独立世界书）
 * 运行：pnpm worldbook:dnd-combat
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const refPath = path.join(
  root,
  'src',
  '一些想法',
  '0-2【不带世界书】原始 dnd5e规则世界书v1.2.json',
);

/** YAML 根节点为字面量块标量，便于 tavern_sync 整段作为条目正文 */
function toRootLiteralYaml(text) {
  const lines = String(text).split('\n');
  const body = lines.map(line => (line.length === 0 ? '' : `  ${line}`)).join('\n');
  return `|\n${body}\n`;
}

const o = JSON.parse(fs.readFileSync(refPath, 'utf8'));
const battle = o.entries.find(e => e.comment === '判定');
const dice = o.entries.find(e => e.comment === '骰子池');
const xp = o.entries.find(e => e.comment === '经验获取规则');
if (!battle || !dice || !xp) throw new Error('reference entries missing');

const idx = battle.content.indexOf('## 战斗输出案例');
const core = idx >= 0 ? battle.content.slice(0, idx).trim() : battle.content;
const showcase = idx >= 0 ? battle.content.slice(idx).trim() : '';

const HUD_PROTOCOL = `
## 战斗 HUD 同步协议（配套 Vault 界面「战斗 HUD」标签，与叙事并行）

在输出**先攻判定**、**状态面板**、**任意需掷骰的检定结果**、**本轮结算**或**战斗结束结算**之后，**必须**在回复中另起一行追加**单行**机器可读 JSON（不要用 markdown 代码块包裹整行；JSON 内使用双引号；尽量压缩为单行）：

\`COMBAT_JSON:\` + JSON

### JSON 字段（v1）
- \`v\`: 固定 1
- \`phase\`: \`"initiative" | "status" | "check" | "round_end" | "battle_end" | "encounter"\`
  - encounter：刚遇敌、尚未先攻
  - initiative：先攻掷骰与排序结果
  - status：轮开始状态总览
  - check：单次攻击/豁免/技能等检定（可含伤害）
  - round_end：本轮结算
  - battle_end：战斗完全结束与掉落统计
- \`round\`: 当前轮次（整数，从 1 起）
- \`actors\`: 数组，元素示例 \`{"id":"a1","name":"莱拉","hp":32,"hpMax":32,"mp":14,"mpMax":14,"tags":["无"],"side":"ally"}\`（side 可用 ally / foe）
- \`lastRoll\`（可选）：\`{"title":"长弓速射","expr":"1d20+6","total":25,"dc":14,"grade":"crit_success","damage":11,"damageType":"穿刺"}\`
  - \`grade\`: \`crit_success\` | \`success\` | \`fail\` | \`crit_fail\`

**要求**：数值须与上文叙事一致；同一轮内多次检定时可多次输出 COMBAT_JSON，以界面最后一次为准展示动效。玩家可在 Vault 底部点选「战斗 HUD」查看。
`.trim();

const hubText = `【DND5E 战斗规则已挂载】进行战斗、先攻、攻击检定、伤害掷骰、豁免或遇敌时，须遵循同角色卡世界书中「DND5E·战斗核心+HUD」「DND5E·骰池协议」等条目；禁止虚构骰点，仅用公平骰池。每步须在叙事后追加单行 \`COMBAT_JSON:{...}\`（格式见「战斗核心+HUD」）。`;

const coreWithHud = `${core}\n\n---\n\n${HUD_PROTOCOL}`;

const vaultCombatDir = path.join(root, 'src', 'vault', '世界书', '战斗');
fs.mkdirSync(vaultCombatDir, { recursive: true });

const vaultFiles = [
  ['dnd5e-战斗枢纽.yaml', hubText],
  ['dnd5e-战斗核心+hud.yaml', coreWithHud],
  ['dnd5e-骰池协议.yaml', dice.content],
  ['dnd5e-经验规则.yaml', xp.content],
  ['dnd5e-长案例-战士射手对巨魔.yaml', showcase || '（无拆分案例正文）'],
];

for (const [name, body] of vaultFiles) {
  const fp = path.join(vaultCombatDir, name);
  fs.writeFileSync(fp, toRootLiteralYaml(body), 'utf8');
}

const base = {
  keysecondary: [],
  exclude_key: [],
  position: 4,
  depth: 4,
  probability: 100,
  disable: false,
  excludeRecursion: false,
  preventRecursion: false,
};

const entries = [
  {
    uid: 920100,
    comment: 'DND5E·战斗枢纽（常时短条）',
    content: hubText,
    constant: true,
    selective: false,
    key: [],
    order: 1,
    ...base,
  },
  {
    uid: 920101,
    comment: 'DND5E·战斗核心+HUD',
    content: `${core}\n\n---\n\n${HUD_PROTOCOL}`,
    constant: false,
    selective: true,
    key: ['先攻', '回合', '战斗', '攻击', '施法', '检定', '遇敌', '伤害', '法术', 'AC', '豁免', '命中', '骰'],
    order: 11,
    ...base,
  },
  {
    uid: 920102,
    comment: 'DND5E·骰池协议',
    content: dice.content,
    constant: false,
    selective: true,
    key: ['骰子', 'roll', '伤害骰', 'd20', '2d6', '1d8', '骰池', '公平骰'],
    order: 10,
    ...base,
  },
  {
    uid: 920103,
    comment: 'DND5E·经验规则',
    content: xp.content,
    constant: false,
    selective: true,
    key: ['经验', '升级', '魔力', '吸收', 'XP', '等级'],
    order: 7,
    ...base,
  },
  {
    uid: 920104,
    comment: 'DND5E·长案例·战士射手对巨魔',
    content: showcase || '（无拆分案例正文）',
    constant: false,
    selective: true,
    key: ['案例', '巨魔', '卡恩', '莱拉', '完整演示', '战报范例'],
    order: 40,
    ...base,
  },
];

const out = {
  name: 'DND5E 战斗系统 + Combat HUD v1（token 优化独立书）',
  description:
    '从 v1.2 参考拆分：常时仅短枢纽；战斗/骰池/经验按需关键词激活；长案例单独条目；配套 COMBAT_JSON 单行协议供 Vault「战斗 HUD」动效。',
  entries,
  exportedAt: new Date().toISOString(),
  version: '1.0',
};

const assetsDir = path.join(root, 'assets', 'worldbook');
fs.mkdirSync(assetsDir, { recursive: true });
const outFile = path.join(assetsDir, 'dnd5e-combat-hud-v1.json');
fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
console.info('[build-dnd5e-combat-worldbook] vault yaml →', vaultCombatDir);
console.info('[build-dnd5e-combat-worldbook] optional json →', outFile, 'entries', entries.length);
