/**
 * Sherlock 界面类型（翻书式开局 + MVU）
 */
import type { GameDifficultyId } from './lib/openingBookDifficulty';
import type { AttrKey, CharacterModeId, OpeningLocationId } from './lib/openingBook';

export type { AttrKey, CharacterModeId, OpeningLocationId, GameDifficultyId };

/**
 * 四页手记：难度与身份 → 所在位置 → 七维加点点数分配 → 钤印
 */
export interface SherlockOpeningFormData {
  /** 与 stat_data.世界层.游戏难度、世界书「雾都 · 博弈难度」同步 */
  gameDifficulty: GameDifficultyId;
  investigatorName: string;
  appearance: string;
  personalBackstory: string;
  gender: 'male' | 'female' | 'other';
  characterMode: CharacterModeId;
  locationId: OpeningLocationId;
  /** 每项为 BASE 之上的加点点数，总和须等于 ATTR_BONUS_POOL */
  attrBonus: Record<AttrKey, number>;
}
