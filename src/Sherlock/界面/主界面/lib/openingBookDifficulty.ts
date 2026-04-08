/**
 * 与 MVU「世界层.游戏难度」及世界书条目「雾都 · 博弈难度（AI）」对齐。
 */
export const GAME_DIFFICULTY_IDS = ['narrative', 'standard', 'hardcore'] as const;
export type GameDifficultyId = (typeof GAME_DIFFICULTY_IDS)[number];

/** 写入 stat_data.世界层.游戏难度（中文，便于叙事与 COT 阅读） */
export const GAME_DIFFICULTY_STAT_LABEL: Record<GameDifficultyId, string> = {
  narrative: '叙事向导',
  standard: '标准探案',
  hardcore: '硬核博弈',
};

export const GAME_DIFFICULTY_OPTIONS: Array<{
  id: GameDifficultyId;
  title: string;
  tagline: string;
  desc: string;
  egg: string;
}> = [
  {
    id: 'narrative',
    title: '叙事向导',
    tagline: '像华生记手稿',
    desc: '氛围与人物优先，检定偏宽，选项会写清短期后果；适合先读伦敦、再入棋局。',
    egg: '「把笔记留给日后出版」——失败很少一击致命，但别指望莫里亚蒂手下留情太久。',
  },
  {
    id: 'standard',
    title: '标准探案',
    tagline: '贝克街式的公平',
    desc: '线索、对抗与资源与规则表平衡；DC 与《雾都 · 博弈与检定》一致，是推荐的默认体验。',
    egg: '「数据与直觉各半」——既非童话，也非酷刑；雷斯垂德会抱怨，但卷宗仍站得住。',
  },
  {
    id: 'hardcore',
    title: '硬核博弈',
    tagline: '莱辛巴赫式的代价',
    desc: '反派与时限更紧，误导更多，DC 常取上沿；失败须有清晰叙事代价，检定与变量须对齐。',
    egg: '「当你排除了所有不可能……」仍可能摔断肋骨——棋盘不会等你喘匀气。',
  },
];
