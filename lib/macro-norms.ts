import type { Goal, MacroNormsPerKg } from "./types";

export const DEFAULT_TARGET_FIBER = 25;

export interface SuggestedNutritionNorms {
  macroNormsPerKg: MacroNormsPerKg;
  targetFiber: number;
}

/** Базові норми г/кг та клітковина (г/день) за ціллю та активністю */
export function suggestNutritionNorms(
  goal: Goal,
  activityLevel: number
): SuggestedNutritionNorms {
  let macroNormsPerKg: MacroNormsPerKg;
  let targetFiber: number;

  switch (goal) {
    case "muscle_gain":
      macroNormsPerKg = { protein: 2.5, fat: 1.3, carbs: 3.5 };
      targetFiber = 32;
      break;
    case "weight_loss":
      macroNormsPerKg = { protein: 2.2, fat: 1.0, carbs: 2.0 };
      targetFiber = 28;
      break;
    case "maintenance":
    case "health":
    default:
      macroNormsPerKg = { protein: 2.0, fat: 1.1, carbs: 2.5 };
      targetFiber = 25;
      break;
  }

  let carbsBonus = 0;
  if (activityLevel >= 1.725) carbsBonus = 0.5;
  else if (activityLevel >= 1.55) carbsBonus = 0.4;
  else if (activityLevel >= 1.375) carbsBonus = 0.3;

  return {
    macroNormsPerKg: {
      ...macroNormsPerKg,
      carbs: Math.round((macroNormsPerKg.carbs + carbsBonus) * 10) / 10,
    },
    targetFiber,
  };
}
