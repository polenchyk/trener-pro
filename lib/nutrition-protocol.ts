import type { Goal, MacroNormsPerKg, Sex } from "./types";
import {
  HANDBOOK_MACRO_RANGES,
  TRAINER_HANDBOOK_AI_PROMPT,
  TRAINER_HANDBOOK_JUSTIFICATION_PROMPT,
} from "./trainer-handbook-knowledge";

/** Діапазони г/кг — синхронізовано з Картотекою тренера */
export const PROTOCOL_MACRO_RANGES = HANDBOOK_MACRO_RANGES;

/** Текст правил для системного промпту ШІ (джерело: Картотека тренера) */
export const NUTRITION_PROTOCOL_PROMPT = TRAINER_HANDBOOK_AI_PROMPT;

export const MENU_JUSTIFICATION_PROMPT = TRAINER_HANDBOOK_JUSTIFICATION_PROMPT;

function pickInRange(min: number, max: number, bias: "low" | "mid" | "high"): number {
  if (bias === "low") return min;
  if (bias === "high") return max;
  return Math.round(((min + max) / 2) * 10) / 10;
}

/** Норми г/кг за протоколом з урахуванням статі та цілі */
export function protocolMacroNormsPerKg(
  sex: Sex,
  goal: Goal,
  activityLevel: number
): MacroNormsPerKg {
  const ranges = PROTOCOL_MACRO_RANGES[sex === "male" ? "male" : "female"];

  let proteinBias: "low" | "mid" | "high" = "mid";
  let carbsBias: "low" | "mid" | "high" = "mid";
  let fat = pickInRange(ranges.fat.min, ranges.fat.max, "mid");

  if (goal === "weight_loss") {
    proteinBias = "high";
    carbsBias = "low";
  } else if (goal === "muscle_gain") {
    proteinBias = "high";
    carbsBias = "high";
  }

  if (activityLevel >= 1.55) carbsBias = carbsBias === "low" ? "mid" : "high";
  if (activityLevel >= 1.725 && sex === "male") proteinBias = "high";

  return {
    protein: pickInRange(ranges.protein.min, ranges.protein.max, proteinBias),
    fat,
    carbs: pickInRange(ranges.carbs.min, ranges.carbs.max, carbsBias),
  };
}
