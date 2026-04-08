/**
 * 主线棋局 / 雾都锚点：界面叙事提示（不写入 MVU）。
 */

/** 从时间线节点关键词嗅探「剧情相位」氛围 */
export function plotPhaseBadge(node: string): { label: string; chipClass: string } {
  const n = node.trim();
  if (/开篇|序|起点|第一/.test(n)) return { label: '序章相位', chipClass: 'border-sky-400/40 bg-sky-500/15 text-sky-100' };
  if (/终|结局|落幕|收束|尾声/.test(n)) return { label: '收束相位', chipClass: 'border-rose-400/40 bg-rose-600/20 text-rose-100' };
  if (/对峙|池|决战|莱辛巴赫|东风/.test(n)) return { label: '高潮相位', chipClass: 'border-amber-400/45 bg-amber-500/15 text-amber-100' };
  if (/雾|夜|雨|雪/.test(n)) return { label: '雾象相位', chipClass: 'border-slate-400/40 bg-slate-600/25 text-slate-100' };
  if (/季|篇|章/.test(n)) return { label: '章节相位', chipClass: 'border-violet-400/40 bg-violet-500/15 text-violet-100' };
  return { label: '推进中', chipClass: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100' };
}

/** 粗略从 HH:MM 读昼夜氛围（展示用） */
export function plotTimeFlavor(time: string): string {
  const m = time.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return '时间流逝中——注意证物时效与宵禁叙事。';
  const h = parseInt(m[1], 10);
  if (h >= 5 && h < 9) return '拂晓前后：街头尚薄雾，适合潜行与盯梢。';
  if (h >= 9 && h < 17) return '白昼：明面调查、苏格兰场与媒体场更活跃。';
  if (h >= 17 && h < 21) return '黄昏：交接班与视线死角增多，暗线易动。';
  if (h >= 21 || h < 5) return '深夜：非法潜入、法医与停尸间叙事权重上升。';
  return '钟面推移中——回合制行动与体力叙事可对齐。';
}

/** 情报覆盖度 → 呼吸灯视觉强度文案 */
export function plotSyncNarrative(intelPct: number): { title: string; body: string } {
  if (intelPct >= 70)
    return {
      title: '耳目全开',
      body: '暗流在你图上近乎实时显影；适合并案、预判与对莫里亚蒂先手。',
    };
  if (intelPct >= 40)
    return {
      title: '耳目尚齐',
      body: '线人与卷宗尚可支撑主线；缺口处可用检定或设施补足。',
    };
  return {
    title: '雾厚视距短',
    body: '情报稀薄时，故事会更偏「摸黑」与误判——先多挖线索，再押大动作。',
  };
}
