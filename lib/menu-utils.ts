import type { DayMenu, Macros, MenuDish, WeekDay, WeeklyMenu } from "./types";
import { MEAL_LABELS, WEEK_DAYS } from "./types";

export const DAY_META_KEYS = new Set(["totalCalories", "macros"]);

const MEAL_KEY_ALIASES: Record<string, keyof typeof MEAL_LABELS> = {
  breakfast: "breakfast",
  сніданок: "breakfast",
  lunch: "lunch",
  обід: "lunch",
  dinner: "dinner",
  вечеря: "dinner",
};

function isValidDish(d: unknown): d is MenuDish {
  return (
    !!d &&
    typeof d === "object" &&
    typeof (d as MenuDish).title === "string" &&
    typeof (d as MenuDish).calories === "number"
  );
}

function normalizeDish(d: MenuDish): MenuDish {
  return {
    title: d.title,
    portion: d.portion ?? "",
    calories: d.calories,
    protein: typeof d.protein === "number" ? d.protein : 0,
    fat: typeof d.fat === "number" ? d.fat : 0,
    carbs: typeof d.carbs === "number" ? d.carbs : 0,
  };
}

/** Ключі прийомів їжі в об'єкті дня (без totalCalories / macros) */
export function getMealKeys(day: DayMenu): string[] {
  return Object.keys(day).filter(
    (k) => !DAY_META_KEYS.has(k) && Array.isArray(day[k])
  );
}

function mealSortOrder(key: string): number {
  const lower = key.toLowerCase();
  const alias = MEAL_KEY_ALIASES[lower];
  if (alias === "breakfast") return 0;
  if (alias === "lunch") return 10;
  if (alias === "dinner") return 100;
  if (/перекус|snack/i.test(lower)) {
    const num = lower.match(/(\d+)/)?.[1];
    return 50 + (num ? parseInt(num, 10) : 0);
  }
  return 75;
}

/** Людська назва та емодзі для ключа прийому їжі */
export function resolveMealLabel(key: string): { name: string; emoji: string } {
  const lower = key.toLowerCase();
  const alias = MEAL_KEY_ALIASES[lower];
  if (alias) return MEAL_LABELS[alias];

  if (/^snack(_\d+)?$/i.test(lower) || /перекус/i.test(lower)) {
    const num = lower.match(/(\d+)/)?.[1];
    return {
      name: num ? `Перекус ${num}` : "Перекус",
      emoji: "🍎",
    };
  }

  if (/^[а-яіїєґ\s'-]+$/i.test(key)) {
    return { name: key, emoji: "🍽" };
  }

  return {
    name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
    emoji: "🍽",
  };
}

export interface DayMealBlock {
  key: string;
  dishes: MenuDish[];
  label: { name: string; emoji: string };
}

/** Усі прийоми їжі дня, відсортовані в логічному порядку */
export function getMealsFromDay(day: DayMenu): DayMealBlock[] {
  return getMealKeys(day)
    .map((key) => ({
      key,
      dishes: (day[key] as MenuDish[]).filter(isValidDish).map(normalizeDish),
      label: resolveMealLabel(key),
    }))
    .filter((m) => m.dishes.length > 0)
    .sort((a, b) => mealSortOrder(a.key) - mealSortOrder(b.key));
}

/** Підсумок калорій та БЖВ з усіх страв усіх прийомів їжі */
export function computeDayTotals(day: DayMenu): { totalCalories: number; macros: Macros } {
  let totalCalories = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;

  for (const { dishes } of getMealsFromDay(day)) {
    for (const dish of dishes) {
      totalCalories += dish.calories;
      protein += dish.protein;
      fat += dish.fat;
      carbs += dish.carbs;
    }
  }

  return {
    totalCalories: Math.round(totalCalories),
    macros: {
      protein: Math.round(protein),
      fat: Math.round(fat),
      carbs: Math.round(carbs),
    },
  };
}

/** Нормалізує страви та перераховує totalCalories / macros за день */
export function normalizeDayMenu(day: DayMenu): DayMenu {
  const result: DayMenu = {
    ...day,
    breakfast: Array.isArray(day.breakfast)
      ? day.breakfast.filter(isValidDish).map(normalizeDish)
      : [],
    lunch: Array.isArray(day.lunch) ? day.lunch.filter(isValidDish).map(normalizeDish) : [],
    dinner: Array.isArray(day.dinner) ? day.dinner.filter(isValidDish).map(normalizeDish) : [],
  };

  for (const key of getMealKeys(day)) {
    if (key === "breakfast" || key === "lunch" || key === "dinner") continue;
    const dishes = (day[key] as MenuDish[]).filter(isValidDish).map(normalizeDish);
    if (dishes.length > 0) {
      result[key] = dishes;
    }
  }

  const totals = computeDayTotals(result);
  result.totalCalories = totals.totalCalories;
  result.macros = totals.macros;
  return result;
}

/** Форматує БЖВ однієї страви для UI / експорту */
export function formatDishMacros(dish: MenuDish): string {
  return `Б: ${dish.protein}г | Ж: ${dish.fat}г | В: ${dish.carbs}г`;
}

function isValidDayMenu(day: unknown): day is DayMenu {
  if (!day || typeof day !== "object") return false;
  const d = day as Record<string, unknown>;
  if (typeof d.totalCalories !== "number" || !d.macros) return false;

  const mealKeys = Object.keys(d).filter(
    (k) => !DAY_META_KEYS.has(k) && Array.isArray(d[k])
  );
  if (mealKeys.length === 0) return false;

  return mealKeys.some((k) => {
    const arr = d[k] as unknown[];
    return arr.length > 0 && arr.every(isValidDish);
  });
}

/** Чи містить об'єкт days хоча б один валідний день тижня */
export function hasValidMenuDays(
  days: unknown
): days is Record<WeekDay, DayMenu> {
  if (!days || typeof days !== "object") return false;
  return WEEK_DAYS.some((d) => isValidDayMenu((days as Record<string, DayMenu>)[d]));
}

/** Витягує days з різних форматів запиту/сховища */
export function extractMenuDays(source: {
  days?: unknown;
  menuDays?: unknown;
  weeklyMenu?: WeeklyMenu | null;
}): Record<WeekDay, DayMenu> | null {
  const candidate =
    source.weeklyMenu?.days ?? source.menuDays ?? source.days ?? null;
  return hasValidMenuDays(candidate) ? candidate : null;
}

export interface AdjustApiResult {
  updatedDays: Partial<Record<WeekDay, DayMenu>> | null;
  explanation?: string;
}

/** Нормалізує JSON-відповідь AI (updatedDays / updatedMenu / note / explanation) */
export function parseAdjustResponse(parsed: unknown): AdjustApiResult {
  if (!parsed || typeof parsed !== "object") {
    return { updatedDays: null };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.updatedDays === null) {
    const explanation =
      typeof obj.explanation === "string"
        ? obj.explanation.trim()
        : typeof obj.note === "string"
          ? obj.note.trim()
          : undefined;
    return { updatedDays: null, explanation: explanation || undefined };
  }

  let rawDays: unknown = obj.updatedDays;
  if (!rawDays && obj.updatedMenu && typeof obj.updatedMenu === "object") {
    const menu = obj.updatedMenu as Record<string, unknown>;
    rawDays = menu.days ?? menu;
  }

  const updatedDays: Partial<Record<WeekDay, DayMenu>> = {};
  if (rawDays && typeof rawDays === "object") {
    for (const day of WEEK_DAYS) {
      const dayMenu = (rawDays as Record<string, DayMenu>)[day];
      if (isValidDayMenu(dayMenu)) {
        updatedDays[day] = normalizeDayMenu(dayMenu);
      }
    }
  }

  const explanation =
    typeof obj.explanation === "string"
      ? obj.explanation.trim()
      : typeof obj.note === "string"
        ? obj.note.trim()
        : undefined;

  const hasDays = Object.keys(updatedDays).length > 0;
  return {
    updatedDays: hasDays ? updatedDays : null,
    explanation: explanation || undefined,
  };
}

/** Нормалізує всі дні тижневого меню */
export function normalizeWeeklyMenu(menu: WeeklyMenu): WeeklyMenu {
  const days = { ...menu.days };
  for (const day of WEEK_DAYS) {
    if (days[day]) {
      days[day] = normalizeDayMenu(days[day]);
    }
  }
  return { ...menu, days };
}

/** Нормалізує день або повертає null, якщо структура невалідна */
export function tryNormalizeDayMenu(day: unknown): DayMenu | null {
  if (!isValidDayMenu(day)) return null;
  return normalizeDayMenu(day);
}

/** Чи інструкція стосується всього тижня (білки, БЖВ, меню загалом) */
export function isGlobalMenuInstruction(instruction: string): boolean {
  const lower = instruction.toLowerCase();
  const mentionsDay = WEEK_DAYS.some((d) => lower.includes(d.toLowerCase()));
  if (mentionsDay) return false;
  return /меню|білк|бжв|калор|макро|вуглев|жир|раціон|тижден/i.test(lower);
}
