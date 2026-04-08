/**
 * 开局手记固定文案与世界层摘要（与角色卡《伦敦博弈场》变量表一致，不依赖玩家自定义「烫金书名」）。
 */
export const OPENING_BOOK_TITLE = '伦敦博弈场 · 探案手记';

/** 写入 stat_data.世界层，供叙事与 COT 锚定 */
export const LONDON_WORLD_ESSENCE =
  '吉姆·莫里亚蒂主导的「全伦敦犯罪棋局」与秘密推进的「辐射异变超能力觉醒计划」——以切尔诺贝利残留辐射诱导高智商个体异变；表层连环凶案，底层颠覆秩序。';

export const LONDON_WORLD_STATUS =
  '1996 伦敦：表层秩序稳定，地下网络渗透苏格兰场与政经媒体；微量辐射泄露点与零星超能力觉醒被苏格兰场封锁，仅夏洛克隐约察觉。你是唯一知晓《神探夏洛克》全剧情与辐射计划、能打破双线棋局的变量。';

/** 酒馆玩家名占位；档案姓名为空时写入 stat_data */
export const USER_NAME_PLACEHOLDER = '{{user}}';

export function resolveInvestigatorName(raw: string): string {
  const t = raw.trim();
  return t || USER_NAME_PLACEHOLDER;
}

/** 固定模板：选择「陈媛 / 柯司博」时写入档案栏（可改）；文案对齐《神探夏洛克 角色传记》世界书 */
export const FIXED_CHARACTER_PRESETS = {
  chen_yuan: {
    investigatorName: '陈媛',
    appearance:
      '高挑利落，妆容与长发永远打理得精致亮眼；穿搭大胆前卫，走在雾都街上很难不引人侧目。共情写在脸上——见受害者受苦会先红眼眶，却也会在笔录室里把对方哄得卸下心防。',
    personalBackstory:
      '自陕西而来的穿越者，十九岁落在九六年的伦敦，凭零碎「未来记忆」在警队站稳脚跟，跟着夏洛克一行跑现场。特质「八面玲珑」锁死：你擅长沟通与共情、体育素质出众，却也容易依赖伙伴、冲动上头；对多数异性带着偏见，唯独对 K 先生有种自己也说不清的牵引。失忆暂时遮住了你与 K 的过往——直到终局，你必须在挚友与挚爱之间做选择。',
    gender: 'female' as const,
  },
  kesibo: {
    investigatorName: '柯司博',
    appearance:
      '身形清瘦，目光锐利，衣着务实得像随时能钻进机房；指尖留着键盘与焊台的旧痕，背包里常见备用盘与线材。对外人先谈条件再伸手，对认定的朋友却从不计较。',
    personalBackstory:
      '原为二十一世纪腾讯出身的计算机好手，与 K 先生曾是过命交情；意外穿越到九六年后撞击失忆，忘了来历与旧友。特质「数字破壁」锁死：你在当代设备上仍能撕开监控、链路与加密通讯的口子，梳理线索一丝不苟，却也有市侩抠门、唯利是图的一面，更受不了独处——孤独恐惧会逼你拼命把大家攒在一起。决战将至，记忆碎片与立场拉扯会一同找上门。',
    gender: 'male' as const,
  },
} as const;

/** 切回「自定义」时清空档案栏（姓名空则仍可由 stat 使用 {{user}}） */
export const CUSTOM_IDENTITY_FIELDS = {
  investigatorName: '',
  appearance: '',
  personalBackstory: '',
  gender: 'other' as const,
};
