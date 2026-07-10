import type { Client, MacroNormsPerKg, Macros } from "./types";
import { DEFAULT_MACRO_NORMS_PER_KG, DEFAULT_TARGET_FIBER, latestWeight } from "./types";

/** Абсолютні грами БЖВ з ваги та норм г/кг */
export function calcMacrosFromWeight(
  weightKg: number,
  norms: MacroNormsPerKg = DEFAULT_MACRO_NORMS_PER_KG
): Macros {
  if (weightKg <= 0) {
    return { protein: 0, fat: 0, carbs: 0 };
  }
  return {
    protein: Math.round(weightKg * norms.protein),
    fat: Math.round(weightKg * norms.fat),
    carbs: Math.round(weightKg * norms.carbs),
  };
}

/** Калорії з макросів (4/9/4 ккал на г) */
export function calcCaloriesFromMacros(macros: Macros): number {
  return Math.round(macros.protein * 4 + macros.fat * 9 + macros.carbs * 4);
}

export function getClientMacroNorms(client: Client): MacroNormsPerKg {
  return client.macroNormsPerKg ?? DEFAULT_MACRO_NORMS_PER_KG;
}

export function getClientTargetFiber(client: Client): number {
  return client.targetFiber ?? DEFAULT_TARGET_FIBER;
}

/** Цільові макроси клієнта за поточною вагою */
export function getClientTargetMacros(client: Client): Macros {
  const weight = latestWeight(client) ?? 0;
  return calcMacrosFromWeight(weight, getClientMacroNorms(client));
}

/** Текстовий блок цільових БЖВ та клітковини для чату / AI */
export function formatTargetMacrosBlock(client: Client): string {
  const weight = latestWeight(client);
  const macros = getClientTargetMacros(client);
  const fiber = getClientTargetFiber(client);
  if (!weight || weight <= 0) {
    return "Цільові БЖВ: вкажіть вагу клієнта для розрахунку.";
  }
  return `Цільові БЖВ (вага ${weight} кг): Б-${macros.protein}г, Ж-${macros.fat}г, В-${macros.carbs}г, Кл-${fiber}г`;
}
