/**
 * 一次性补丁：角色传记世界书 — 常驻置顶 + 触发式角色条 + 姓名 comment + 扩展关键词
 * 运行：node src/Sherlock/世界书/patch-character-bio-worldbook.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '神探夏洛克 角色传记.json');

const constantContent = `【神探夏洛克 · 角色传记 · 常驻规则】

【言行与设定强制对齐】
凡剧情中出现、且本世界书「角色传记」条目里已有档案的人物（如夏洛克·福尔摩斯、约翰·华生、陈媛、柯司博、K先生、吉姆·莫里亚蒂等），assistant 描写其**说话方式、动作习惯、情绪反应、价值观与弱点**时，必须与本世界书中对应条目的 traits、hidden_traits、communication_style、speak_pattern、behavior_logic 等描写一致；不得在无合理解释下 OOC，不得把高智商角色写成无脑反派或捧哏工具人。

【触发式使用传记正文】
各角色**传记正文**为选择性注入：仅当当前上下文中出现与该角色**姓名或本条目关键词**可明确对应时，再启用该条档案；未聚焦于该角色时，禁止大段复述传记全文，以节省 token。

【关键词与指称】
叙事中提及角色时，请尽量使用其**全名或关键词**（如「夏洛克」「福尔摩斯」「华生」「莫里亚蒂」「K先生」等），以便世界书稳定命中；避免只用过度模糊的代称导致传记无法触发。

【与玩家自定义身份】
若玩家扮演穿越者/警探等自定义身份，不得因玩家线而削弱原著向 NPC 的性格厚度；NPC 仍须按本书传记行事。玩家自由不等于 NPC 设定崩坏。`;

const charSpecs = [
  {
    oldId: '0',
    name: '夏洛克·福尔摩斯',
    keys: ['夏洛克', '福尔摩斯', 'Sherlock', '咨询侦探', '夏洛克·福尔摩斯'],
  },
  {
    oldId: '1',
    name: '约翰·华生',
    keys: ['华生', '约翰·华生', '约翰·H·华生', '军医华生', '约翰华生', 'Dr. Watson', 'Watson'],
  },
  { oldId: '2', name: '陈媛', keys: ['陈媛'] },
  { oldId: '3', name: '柯司博', keys: ['柯司博'] },
  {
    oldId: '4',
    name: 'K先生',
    keys: ['K先生', 'K 先生', '幕后首脑', '穿越者作者'],
  },
  {
    oldId: '5',
    name: '吉姆·莫里亚蒂',
    keys: ['莫里亚蒂', '吉姆·莫里亚蒂', '吉姆莫里亚蒂', '咨询罪犯', 'Jim Moriarty', 'Moriarty'],
  },
];

function main() {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const tpl = data.entries['0'];

  const constantEntry = {
    uid: 0,
    key: [],
    keysecondary: [],
    comment: '角色传记·常驻（言行与设定对齐）',
    content: constantContent,
    constant: true,
    vectorized: tpl.vectorized,
    selective: true,
    selectiveLogic: tpl.selectiveLogic,
    addMemo: tpl.addMemo,
    order: tpl.order,
    position: tpl.position,
    disable: tpl.disable,
    excludeRecursion: tpl.excludeRecursion,
    preventRecursion: tpl.preventRecursion,
    delayUntilRecursion: tpl.delayUntilRecursion,
    probability: tpl.probability,
    useProbability: tpl.useProbability,
    depth: 0,
    group: '',
    groupOverride: tpl.groupOverride,
    groupWeight: tpl.groupWeight,
    scanDepth: null,
    caseSensitive: tpl.caseSensitive,
    matchWholeWords: tpl.matchWholeWords,
    useGroupScoring: tpl.useGroupScoring,
    automationId: tpl.automationId,
    role: tpl.role,
    sticky: tpl.sticky,
    cooldown: tpl.cooldown,
    delay: tpl.delay,
    displayIndex: 0,
  };

  const newEntries = { '0': constantEntry };

  charSpecs.forEach((spec, i) => {
    const old = data.entries[spec.oldId];
    if (!old) {
      throw new Error(`missing entry ${spec.oldId}`);
    }
    const idx = i + 1;
    newEntries[String(idx)] = {
      ...old,
      uid: idx,
      displayIndex: idx,
      key: spec.keys,
      keysecondary: [],
      comment: spec.name,
      constant: false,
      selective: true,
      depth: old.depth,
      scanDepth: old.scanDepth,
    };
  });

  fs.writeFileSync(FILE, `${JSON.stringify({ entries: newEntries }, null, 2)}\n`, 'utf8');
  console.log(`OK: ${FILE} — 常驻 1 + 角色 ${charSpecs.length} = ${Object.keys(newEntries).length}`);
}

main();
