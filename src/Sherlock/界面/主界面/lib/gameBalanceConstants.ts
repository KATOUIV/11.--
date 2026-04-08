/**
 * 数值只改这一处即可（不必懂代码结构）：
 * - `DIMENSIONAL_SHOP_AP_COST_MULTIPLIER`：商城奇物标价 = 卡面表内基价 × 该倍率。
 * - `SHERLOCK_LOW_AP_PERCENT_THRESHOLD`：行动余地百分比低于（含）该值时，案卷主区叠雾边预警。
 */
/** 次元商城标价 = 卡面表内 apCost × 此倍率（界面与兑换一致）。若改倍率，请同步 `Modals.tsx` 商城说明里「上浮七成半」等措辞。 */
export const DIMENSIONAL_SHOP_AP_COST_MULTIPLIER = 1.75;

/** 低于此行动余地百分比（含）时：主列叠晕影；与 HUD 条颜色档位可分别调 */
export const SHERLOCK_LOW_AP_PERCENT_THRESHOLD = 30;
