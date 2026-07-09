import type { Goal, Sex } from "./types";

/** Коригування калорій під ціль */
const GOAL_FACTOR: Record<Goal, number> = {
  weight_loss: 0.85,
  muscle_gain: 1.15,
  maintenance: 1,
  health: 1,
};

/**
 * Добова норма калорій за формулою Міффліна-Сан Жеора:
 * жінки: 10×вага + 6.25×зріст − 5×вік − 161
 * чоловіки: 10×вага + 6.25×зріст − 5×вік + 5
 * Потім множимо на коефіцієнт активності та коригуємо під ціль.
 * Результат округлюється до 10 ккал.
 */
export function calcDailyCalories(params: {
  sex: Sex;
  weight: number;
  height: number;
  age: number;
  activityLevel: number;
  goal: Goal;
}): number {
  const { sex, weight, height, age, activityLevel, goal } = params;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
  const calories = bmr * activityLevel * GOAL_FACTOR[goal];
  return Math.max(0, Math.round(calories / 10) * 10);
}
