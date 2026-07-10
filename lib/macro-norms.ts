import type { Goal, MacroNormsPerKg, Sex } from "./types";
import { protocolMacroNormsPerKg } from "./nutrition-protocol";

export const DEFAULT_TARGET_FIBER = 25;

export interface SuggestedNutritionNorms {
  macroNormsPerKg: MacroNormsPerKg;
  targetFiber: number;
}

/** Базові норми г/кг та клітковина за протоколом (стать + ціль + активність) */
export function suggestNutritionNorms(
  goal: Goal,
  activityLevel: number,
  sex: Sex = "female"
): SuggestedNutritionNorms {
  const macroNormsPerKg = protocolMacroNormsPerKg(sex, goal, activityLevel);

  let targetFiber = 25;
  if (goal === "muscle_gain") targetFiber = 32;
  else if (goal === "weight_loss") targetFiber = 28;

  return { macroNormsPerKg, targetFiber };
}
