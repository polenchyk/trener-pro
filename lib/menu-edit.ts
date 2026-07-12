import type { DayMenu, MenuDish } from "./types";
import { computeDayTotals } from "./menu-utils";

/** Калорії з БЖВ: Б×4 + В×4 + Ж×9 */
export function calcCaloriesFromMacros(protein: number, fat: number, carbs: number): number {
  return Math.round(protein * 4 + fat * 9 + carbs * 4);
}

export function recalcDishCalories(dish: MenuDish): MenuDish {
  return {
    ...dish,
    calories: calcCaloriesFromMacros(dish.protein, dish.fat, dish.carbs),
  };
}

/** Оновлює одну страву в дні та перераховує підсумки дня */
export function patchDishInDayMenu(
  day: DayMenu,
  mealId: string,
  dishIndex: number,
  patch: Partial<MenuDish>,
  options?: { recalcCaloriesFromMacros?: boolean }
): DayMenu {
  const meals = day.meals.map((meal) => {
    if (meal.id !== mealId) return meal;
    const dishes = meal.dishes.map((dish, i) => {
      if (i !== dishIndex) return dish;
      // Ручний перезапис: фіксуємо власні значення, база більше не перераховує цю страву
      let updated: MenuDish = { ...dish, ...patch, manualOverride: true };
      if (options?.recalcCaloriesFromMacros) {
        updated = recalcDishCalories(updated);
      }
      return updated;
    });
    return { ...meal, dishes };
  });

  return rebuildDayMenuTotals({ ...day, meals });
}

/** Перераховує totalCalories, macros, fiber дня з сум страв */
export function rebuildDayMenuTotals(day: DayMenu): DayMenu {
  const totals = computeDayTotals(day);
  return {
    ...day,
    totalCalories: totals.totalCalories,
    macros: { ...totals.macros },
    fiber: totals.fiber,
  };
}

/** Сума калорій і БЖВ одного прийому їжі */
export function sumMealMacros(dishes: MenuDish[]): {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
} {
  let calories = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let fiber = 0;
  for (const d of dishes) {
    calories += d.calories || 0;
    protein += d.protein || 0;
    fat += d.fat || 0;
    carbs += d.carbs || 0;
    fiber += d.fiber || 0;
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    fiber: Math.round(fiber),
  };
}
