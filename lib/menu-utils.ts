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

function readNum(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(",", "."));
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function readDishMacro(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = readNum(raw[key]);
    if (v > 0) return v;
  }
  const nested = raw.macros;
  if (nested && typeof nested === "object") {
    const m = nested as Record<string, unknown>;
    for (const key of keys) {
      const v = readNum(m[key]);
      if (v > 0) return v;
    }
  }
  return 0;
}

function isValidDish(d: unknown): d is MenuDish {
  return (
    !!d &&
    typeof d === "object" &&
    typeof (d as MenuDish).title === "string" &&
    readNum((d as Record<string, unknown>).calories) > 0
  );
}

function normalizeDish(d: unknown): MenuDish {
  const raw = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  return {
    title: String(raw.title ?? ""),
    portion: String(raw.portion ?? ""),
    calories: Math.round(readNum(raw.calories)),
    protein: Math.round(
      readDishMacro(raw, "protein", "proteins", "білки", "білок", "b")
    ),
    fat: Math.round(readDishMacro(raw, "fat", "fats", "жири", "жир", "f")),
    carbs: Math.round(
      readDishMacro(raw, "carbs", "carbohydrates", "вуглеводи", "вуглевод", "c")
    ),
    recipe:
      typeof raw.recipe === "string" && raw.recipe.trim()
        ? raw.recipe.trim()
        : typeof raw.instructions === "string" && raw.instructions.trim()
          ? raw.instructions.trim()
          : undefined,
  };
}

/** Розподіляє day.macros по стравах пропорційно калоріям, якщо у страв немає БЖВ */
function fillMissingDishMacros(day: DayMenu): DayMenu {
  const result: DayMenu = { ...day };
  const slots: { key: string; index: number }[] = [];
  let totalDishMacros = 0;

  for (const key of getMealKeys(day)) {
    const dishes = (day[key] as unknown[]).filter(isValidDish).map(normalizeDish);
    (result as Record<string, MenuDish[]>)[key] = dishes;
    dishes.forEach((dish, index) => {
      slots.push({ key, index });
      totalDishMacros += dish.protein + dish.fat + dish.carbs;
    });
  }

  if (totalDishMacros > 0 || slots.length === 0) return result;

  const dayProtein = Math.round(readNum(day.macros?.protein));
  const dayFat = Math.round(readNum(day.macros?.fat));
  const dayCarbs = Math.round(readNum(day.macros?.carbs));
  if (dayProtein + dayFat + dayCarbs === 0) return result;

  const allDishes = slots.map(({ key, index }) => (result[key] as MenuDish[])[index]);
  const totalCal = allDishes.reduce((s, d) => s + d.calories, 0);
  if (totalCal <= 0) return result;

  for (const { key, index } of slots) {
    const dish = (result[key] as MenuDish[])[index];
    const share = dish.calories / totalCal;
    (result[key] as MenuDish[])[index] = {
      ...dish,
      protein: Math.round(dayProtein * share),
      fat: Math.round(dayFat * share),
      carbs: Math.round(dayCarbs * share),
    };
  }

  return result;
}

function readDayMacros(day: DayMenu): Macros {
  return {
    protein: Math.round(readNum(day.macros?.protein)),
    fat: Math.round(readNum(day.macros?.fat)),
    carbs: Math.round(readNum(day.macros?.carbs)),
  };
}
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

  const fromDishes: Macros = {
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
  };

  const dishMacroSum = fromDishes.protein + fromDishes.fat + fromDishes.carbs;
  const fallbackMacros = readDayMacros(day);
  const macros =
    dishMacroSum > 0
      ? fromDishes
      : fallbackMacros.protein + fallbackMacros.fat + fallbackMacros.carbs > 0
        ? fallbackMacros
        : fromDishes;

  return {
    totalCalories: Math.round(totalCalories) || Math.round(readNum(day.totalCalories)),
    macros,
  };
}

/** Нормалізує страви та перераховує totalCalories / macros за день */
export function normalizeDayMenu(day: DayMenu): DayMenu {
  const filled = fillMissingDishMacros(day);
  const totals = computeDayTotals(filled);
  return {
    ...filled,
    totalCalories: totals.totalCalories,
    macros: totals.macros,
  };
}

/** Форматує БЖВ однієї страви для UI / експорту */
export function formatDishMacros(dish: MenuDish): string {
  const p = Math.round(dish.protein || 0);
  const f = Math.round(dish.fat || 0);
  const c = Math.round(dish.carbs || 0);
  return `Б: ${p}г | Ж: ${f}г | В: ${c}г`;
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
