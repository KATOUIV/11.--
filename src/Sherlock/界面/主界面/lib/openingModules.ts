/**
 * 模块化开局：各选项独立配置叙事片段与 stat_data 补丁（与 initvar 默认值叠加 merge，不修改仓库里的变量表文件）
 */
import merge from 'lodash/merge';

export type OpeningTimelineId = 't_christmas96' | 't_newyear97' | 't_late_winter97';
export type OpeningEntryId = 'e_baker' | 'e_scotland_yard' | 'e_barts';

export interface OpeningModuleChoice<T extends string = string> {
  id: T;
  label: string;
  blurb: string;
  /** 对应开局正文的第一段（时间线氛围） */
  paragraphTimeline: string;
  /** 深合并到 stat_data 的片段（至少包含 世界层） */
  statPatch: Record<string, unknown>;
}

export interface OpeningEntryChoice {
  id: OpeningEntryId;
  label: string;
  blurb: string;
  /** 对应开局正文的第二段（调查起点） */
  paragraphEntry: string;
  statPatch: Record<string, unknown>;
  /** 首回合选项区（随切入点变化，保持两条分支） */
  optionBlock: string;
}

export const OPENING_TIMELINES: OpeningModuleChoice<OpeningTimelineId>[] = [
  {
    id: 't_christmas96',
    label: '1996 · 圣诞夜',
    blurb: '雾都与煤气灯，第一季开篇的时间座标。',
    paragraphTimeline:
      '一九九六年圣诞，大本钟的钟声被湿雾磨成钝响。旧案与新政在伦敦的街巷里彼此撕咬，而你正站在「第一季开篇」的门槛上——故事尚未写下第一笔血墨。',
    statPatch: {
      世界层: {
        当前日期: '1996年12月25日',
        当前时间: '00:00',
        时间线节点: '第一季开篇',
      },
    },
  },
  {
    id: 't_newyear97',
    label: '1997 · 新年余波',
    blurb: '千禧年阴影下的第一次涨潮，余波中的苏格兰场与地下线。',
    paragraphTimeline:
      '新年钟声落下不久，伦敦仍浸在节庆与宿醉的灰雾里。九七年的卷宗已经开始堆积——旧贵族的体面与新犯罪的粗粝正面相撞，而你的介入将决定线索先落在桌面还是暗巷。',
    statPatch: {
      世界层: {
        当前日期: '1997年1月8日',
        当前时间: '09:30',
        时间线节点: '新年余波',
      },
    },
  },
  {
    id: 't_late_winter97',
    label: '1997 · 深冬追索',
    blurb: '寒潮、罢工传闻与法医报告上的疑点同时升温。',
    paragraphTimeline:
      '深冬的伦敦，路灯在雪霰里缩成一圈圈黄晕。法医报告与监控录像开始在同一时间轴上对齐——这是适合把「观察」与「演绎」同时推高的季节，也是适合被反咬一口的季节。',
    statPatch: {
      世界层: {
        当前日期: '1997年2月14日',
        当前时间: '14:00',
        时间线节点: '深冬追索',
      },
    },
  },
];

export const OPENING_ENTRIES: OpeningEntryChoice[] = [
  {
    id: 'e_baker',
    label: '贝克街 221B',
    blurb: '顾问侦探的演绎墙与半杯冷茶。',
    paragraphEntry:
      '你从贝克街起步：那间寓所里的演绎墙已经铺开，未干的墨迹与未拆的电报堆成同一种紧迫感——夏洛克与华生的视线会在你开口之前就先落在你的手套与鞋跟上。',
    statPatch: {
      设施与道具层: {
        设施等级: {
          贝克街221B演绎墙: 1,
        },
      },
    },
    optionBlock: `A. 与顾问会合，先过一遍演绎墙上的新线索
B. 与华生整理物证袋，核对时间线矛盾`,
  },
  {
    id: 'e_scotland_yard',
    label: '苏格兰场',
    blurb: '卷宗、印章与警队内部的呼吸缝隙。',
    paragraphEntry:
      '你从苏格兰场切入：雷斯垂德的办公室像一座被案件堆满的灯塔——公文的边角与咖啡渍共同界定「可公开」与「不可说」的边界，而你的一句话就能改变线索权重往哪边倾斜。',
    statPatch: {
      阵营状态层: {
        警队话语权: 5,
        警队公信力: 55,
      },
    },
    optionBlock: `A. 申请调阅在办重案卷宗（提高警队线权重）
B. 走侧门拜访线人登记处，先摸地下线网络`,
  },
  {
    id: 'e_barts',
    label: '巴茨医院',
    blurb: '法医室、停尸间与生理证据的冷光。',
    paragraphEntry:
      '你从巴茨医院启程：消毒水与福尔马林的气味在走廊里拉成一条线，把「死因」与「动机」缝在一起——这里的证据不会说谎，但会挑选读者。',
    statPatch: {
      设施与道具层: {
        设施等级: {
          巴茨医院法医实验室: 1,
        },
      },
    },
    optionBlock: `A. 进入法医实验室，跟进最新尸检报告
B. 从病理档案室调取旧案切片，寻找交叉比对`,
  },
];

export function getTimelineById(id: OpeningTimelineId): OpeningModuleChoice<OpeningTimelineId> {
  const f = OPENING_TIMELINES.find(t => t.id === id);
  return f ?? OPENING_TIMELINES[0];
}

export function getEntryById(id: OpeningEntryId): OpeningEntryChoice {
  const f = OPENING_ENTRIES.find(e => e.id === id);
  return f ?? OPENING_ENTRIES[0];
}

export function buildOpeningStatPatches(timelineId: OpeningTimelineId, entryId: OpeningEntryId): Record<string, unknown> {
  const t = getTimelineById(timelineId);
  const e = getEntryById(entryId);
  return merge({}, t.statPatch, e.statPatch);
}

/**
 * 组装首条 assistant：maintext 两段 + 第三句收束；option 随切入点；sum 供编年史
 */
export function composeOpeningMessages(
  investigatorName: string,
  timelineId: OpeningTimelineId,
  entryId: OpeningEntryId,
): { maintext: string; option: string; sum: string } {
  const t = getTimelineById(timelineId);
  const e = getEntryById(entryId);
  const name = investigatorName.trim() || '访客';

  const maintext = `<maintext>
${t.paragraphTimeline}

${e.paragraphEntry}

你以「${name}」的身份踏入这场博弈——线索、谎言与半枚棋子，都在贝克街的阴影里等你拆解；而此刻的时钟，正指向你选定的起点。
</maintext>`;

  const option = `<option>
${e.optionBlock}
</option>`;

  const timelineNode =
    (t.statPatch['世界层'] as { 时间线节点?: string } | undefined)?.时间线节点 ?? '未知节点';
  const sum = `<sum>${name}｜${timelineNode}｜自${e.label}开局，调查展开。</sum>`;

  return { maintext, option, sum };
}
