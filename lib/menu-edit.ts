import type { DayMenu, DishIngredient, MenuDish } from "./types";
import { computeDayTotals } from "./menu-utils";
import {
  isVegetableFood,
  recalcDishFromIngredients,
} from "./food-calc";

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

/**
 * Оновлює вагу одного інгредієнта страви й миттєво перераховує КБЖУ страви
 * через рушій (овочі не входять у калораж), а потім підсумки дня.
 */
export function patchIngredientGrams(
  day: DayMenu,
  mealId: string,
  dishIndex: number,
  ingredientIndex: number,
  grams: number
): DayMenu {
  const meals = day.meals.map((meal) => {
    if (meal.id !== mealId) return meal;
    const dishes = meal.dishes.map((dish, i) => {
      if (i !== dishIndex || !dish.ingredients) return dish;
      const ingredients = dish.ingredients.map((ing, idx) =>
        idx === ingredientIndex
          ? { ...ing, grams: Math.max(0, Math.round(grams)) }
          : ing
      );
      // Ручний перезапис знімаємо — рушій має право перерахувати
      return recalcDishFromIngredients({
        ...dish,
        ingredients,
        manualOverride: false,
      });
    });
    return { ...meal, dishes };
  });

  return rebuildDayMenuTotals({ ...day, meals });
}

/** Оновлює назву інгредієнта (з ре-детекцією овоча) та перераховує страву */
export function patchIngredientName(
  day: DayMenu,
  mealId: string,
  dishIndex: number,
  ingredientIndex: number,
  name: string
): DayMenu {
  const meals = day.meals.map((meal) => {
    if (meal.id !== mealId) return meal;
    const dishes = meal.dishes.map((dish, i) => {
      if (i !== dishIndex || !dish.ingredients) return dish;
      const ingredients: DishIngredient[] = dish.ingredients.map((ing, idx) =>
        idx === ingredientIndex
          ? { ...ing, name, isVegetable: isVegetableFood(name) }
          : ing
      );
      return recalcDishFromIngredients({
        ...dish,
        ingredients,
        manualOverride: false,
      });
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
