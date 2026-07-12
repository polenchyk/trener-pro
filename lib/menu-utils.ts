import type { DayMenu, Macros, MealSlot, MenuDish, WeekDay, WeeklyMenu } from "./types";
import { MEAL_LABELS, WEEK_DAYS } from "./types";
import { enrichDishFromBase } from "./nutrition-base";

export const DAY_META_KEYS = new Set([
  "totalCalories",
  "macros",
  "fiber",
  "meals",
  "menu_justification",
  "narrative_analysis",
]);

const LEGACY_KEY_META: Record<string, { order: number; title: string }> = {
  breakfast: { order: 10, title: "Сніданок" },
  snack: { order: 20, title: "Перекус між сніданком та обідом" },
  snack_1: { order: 20, title: "Перекус між сніданком та обідом" },
  lunch: { order: 30, title: "Обід" },
  snack_2: { order: 40, title: "Перекус між обідом та вечерею" },
  dinner: { order: 50, title: "Вечеря" },
  snack_3: { order: 60, title: "Перекус після вечері" },
};

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
  const nested = raw.macros ?? raw.macro ?? raw.макроси;
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
  const dish: MenuDish = {
    title: String(raw.title ?? ""),
    portion: String(raw.portion ?? ""),
    calories: Math.round(readNum(raw.calories)),
    protein: Math.round(
      readDishMacro(raw, "protein", "proteins", "білки", "білок", "б", "b", "p")
    ),
    fat: Math.round(readDishMacro(raw, "fat", "fats", "жири", "жир", "ж", "f")),
    carbs: Math.round(
      readDishMacro(raw, "carbs", "carbohydrates", "вуглеводи", "вуглевод", "в", "c")
    ),
    fiber: Math.round(
      readDishMacro(raw, "fiber", "fibre", "клітковина", "кл", "волокна")
    ),
    recipe:
      typeof raw.recipe === "string" && raw.recipe.trim()
        ? raw.recipe.trim()
        : typeof raw.instructions === "string" && raw.instructions.trim()
          ? raw.instructions.trim()
          : undefined,
    manualOverride: raw.manualOverride === true,
    baseProductId:
      typeof raw.baseProductId === "string" ? raw.baseProductId : undefined,
    micros:
      raw.micros && typeof raw.micros === "object"
        ? (raw.micros as MenuDish["micros"])
        : undefined,
  };

  // Жорстка база: стандартизуємо БЖУ моно-продуктів (окрім ручного перезапису)
  return enrichDishFromBase(dish);
}

function legacyKeyToOrder(key: string): number {
  const lower = key.toLowerCase();
  if (LEGACY_KEY_META[lower]) return LEGACY_KEY_META[lower].order;
  const snackNum = lower.match(/^snack_(\d+)$/)?.[1];
  if (snackNum) {
    const n = parseInt(snackNum, 10);
    if (n === 1) return 20;
    if (n === 2) return 40;
    if (n === 3) return 60;
    return 50 + n * 5;
  }
  return 75;
}

function legacyKeyToTitle(key: string): string {
  const lower = key.toLowerCase();
  if (LEGACY_KEY_META[lower]) return LEGACY_KEY_META[lower].title;
  const alias = MEAL_KEY_ALIASES[lower];
  if (alias) return MEAL_LABELS[alias].name;
  if (/^snack_(\d+)$/i.test(lower)) {
    const num = lower.match(/^snack_(\d+)$/)?.[1];
    return num ? `Перекус ${num}` : "Перекус";
  }
  if (/^[а-яіїєґ\s'-]+$/i.test(key)) return key;
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

/** Ключі legacy-формату (breakfast, snack_1 тощо) */
function getLegacyMealKeys(day: Record<string, unknown>): string[] {
  return Object.keys(day).filter(
    (k) => !DAY_META_KEYS.has(k) && Array.isArray(day[k])
  );
}

function normalizeMealSlot(raw: unknown, fallback?: Partial<MealSlot>): MealSlot {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dishes = Array.isArray(o.dishes)
    ? o.dishes.filter(isValidDish).map(normalizeDish)
    : [];
  const order = readNum(o.order) || fallback?.order || 50;
  const title =
    (typeof o.title === "string" && o.title.trim()) ||
    fallback?.title ||
    "Прийом їжі";
  const id =
    (typeof o.id === "string" && o.id.trim()) ||
    fallback?.id ||
    `meal_${order}_${Date.now()}`;

  return { id, title, order, dishes };
}

/** Конвертує legacy-ключі (breakfast, lunch…) у масив MealSlot */
function convertLegacyToMeals(day: Record<string, unknown>): MealSlot[] {
  const meals: MealSlot[] = [];
  for (const key of getLegacyMealKeys(day)) {
    const dishes = (day[key] as unknown[]).filter(isValidDish).map(normalizeDish);
    if (dishes.length === 0) continue;
    meals.push({
      id: key,
      title: legacyKeyToTitle(key),
      order: legacyKeyToOrder(key),
      dishes,
    });
  }
  return meals.sort((a, b) => a.order - b.order);
}

/** Повертає meals-масив з будь-якого формату дня */
export function ensureMealsArray(day: DayMenu | Record<string, unknown>): MealSlot[] {
  const raw = day as Record<string, unknown>;
  if (Array.isArray(raw.meals) && raw.meals.length > 0) {
    return raw.meals
      .map((m) => normalizeMealSlot(m))
      .filter((m) => m.dishes.length > 0)
      .sort((a, b) => a.order - b.order);
  }
  return convertLegacyToMeals(raw);
}

function dedupeMealIds(meals: MealSlot[]): MealSlot[] {
  const used = new Set<string>();
  return meals.map((meal) => {
    let id = meal.id;
    let suffix = 2;
    while (used.has(id)) {
      id = `${meal.id}_${suffix++}`;
    }
    used.add(id);
    return { ...meal, id, dishes: meal.dishes.map((d) => ({ ...d })) };
  });
}

function mealEmoji(order: number): string {
  if (order <= 15) return "🌅";
  if (order >= 45 && order <= 55) return "🌙";
  if (order >= 28 && order <= 32) return "☀️";
  return "🍎";
}

function readMenuJustification(raw: Record<string, unknown>): string | undefined {
  const text =
    (typeof raw.menu_justification === "string" && raw.menu_justification.trim()) ||
    (typeof raw.narrative_analysis === "string" && raw.narrative_analysis.trim()) ||
    "";
  return text || undefined;
}

/** Глибоке клонування дня меню */
export function cloneDayMenu(day: DayMenu): DayMenu {
  const raw = day as unknown as Record<string, unknown>;
  return {
    totalCalories: day.totalCalories,
    macros: { ...(day.macros ?? { protein: 0, fat: 0, carbs: 0 }) },
    fiber: day.fiber,
    meals: ensureMealsArray(day).map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      dishes: m.dishes.map((d) => ({ ...d })),
    })),
    menu_justification: readMenuJustification(raw),
  };
}

function readDayMacros(day: DayMenu | Record<string, unknown>): Macros {
  const raw = (
    (day as DayMenu).macros && typeof (day as DayMenu).macros === "object"
      ? (day as DayMenu).macros
      : {}
  ) as Record<string, unknown>;
  return {
    protein: Math.round(
      readDishMacro(raw, "protein", "proteins", "білки", "білок", "б", "b", "p")
    ),
    fat: Math.round(readDishMacro(raw, "fat", "fats", "жири", "жир", "ж", "f")),
    carbs: Math.round(
      readDishMacro(raw, "carbs", "carbohydrates", "вуглеводи", "вуглевод", "в", "c")
    ),
  };
}

function fillMissingDishMacros(day: DayMenu): DayMenu {
  const meals = ensureMealsArray(day).map((m) => ({
    ...m,
    dishes: m.dishes.filter(isValidDish).map(normalizeDish),
  }));

  const slots: { mealIndex: number; dishIndex: number }[] = [];
  let totalDishMacros = 0;
  let totalDishFiber = 0;

  meals.forEach((meal, mealIndex) => {
    meal.dishes.forEach((dish, dishIndex) => {
      slots.push({ mealIndex, dishIndex });
      totalDishMacros += dish.protein + dish.fat + dish.carbs;
      totalDishFiber += dish.fiber || 0;
    });
  });

  if (slots.length === 0) {
    return { ...day, meals };
  }

  const dayMacros = readDayMacros(day);
  const dayMacroSum = dayMacros.protein + dayMacros.fat + dayMacros.carbs;
  const dayFiber = Math.round(readNum(day.fiber));

  const needsMacroFill =
    dayMacroSum > 0 &&
    (totalDishMacros === 0 ||
      Math.abs(totalDishMacros - dayMacroSum) > Math.max(3, dayMacroSum * 0.08));

  const needsFiberFill = dayFiber > 0 && totalDishFiber === 0;

  if (!needsMacroFill && !needsFiberFill) {
    return { ...day, meals };
  }

  const allDishes = slots.map(
    ({ mealIndex, dishIndex }) => meals[mealIndex].dishes[dishIndex]
  );
  const totalCal = allDishes.reduce((s, d) => s + d.calories, 0);
  if (totalCal <= 0) return { ...day, meals };

  for (const { mealIndex, dishIndex } of slots) {
    const dish = meals[mealIndex].dishes[dishIndex];
    const share = dish.calories / totalCal;
    meals[mealIndex].dishes[dishIndex] = {
      ...dish,
      protein: needsMacroFill ? Math.round(dayMacros.protein * share) : dish.protein,
      fat: needsMacroFill ? Math.round(dayMacros.fat * share) : dish.fat,
      carbs: needsMacroFill ? Math.round(dayMacros.carbs * share) : dish.carbs,
      fiber: needsFiberFill ? Math.round(dayFiber * share) : dish.fiber,
    };
  }

  return { ...day, meals };
}

/** Чи є в дні хоча б одна страва */
export function hasDayMenuContent(day: DayMenu | undefined | null): boolean {
  if (!day) return false;
  return ensureMealsArray(day).some((m) => m.dishes.length > 0);
}

/** Підказка order для нового прийому їжі з інструкції */
export function suggestMealOrderFromInstruction(
  day: DayMenu,
  instruction: string
): number | null {
  const meals = ensureMealsArray(day);
  const maxOrder = meals.length > 0 ? Math.max(...meals.map((m) => m.order)) : 0;
  const lower = instruction.toLowerCase();

  if (/після\s+вечер|після\s+вечері|перед\s+сном|на\s+ніч|ввечері\s+після/i.test(lower)) {
    const afterDinner = Math.max(maxOrder, 50) + 5;
    return afterDinner < 60 ? 60 : afterDinner;
  }
  if (
    /між.*перекус.*обід|до\s+обід|перед\s+обід|другий.*ранков|ще\s+один\s+перекус.*(до|перед)\s+обід|перекус\s*1\.5/i.test(
      lower
    )
  ) {
    return 25;
  }
  if (/між.*сніданок.*обід|після\s+сніданку|перший\s+перекус|ранковий\s+перекус/i.test(lower)) {
    return 20;
  }
  if (/між.*обід.*вечер|після\s+обід/i.test(lower)) {
    return 40;
  }
  if (/додай\s+перекус|новий\s+перекус/i.test(lower)) {
    return maxOrder > 0 ? maxOrder + 5 : 20;
  }
  return null;
}

/** Контекст таймлайну для AI */
export function formatMealsForContext(day: DayMenu): string {
  return ensureMealsArray(day)
    .sort((a, b) => a.order - b.order)
    .map((m) => `id="${m.id}" order=${m.order} title="${m.title}"`)
    .join("; ");
}

/** @deprecated використовуйте formatMealsForContext */
export function formatMealKeysForContext(day: DayMenu): string {
  return formatMealsForContext(day);
}

export interface DayMealBlock {
  id: string;
  title: string;
  order: number;
  dishes: MenuDish[];
  label: { name: string; emoji: string };
}

/** Усі прийоми їжі дня, відсортовані за order */
export function getMealsFromDay(day: DayMenu): DayMealBlock[] {
  return ensureMealsArray(day)
    .map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      dishes: m.dishes.filter(isValidDish).map(normalizeDish),
      label: { name: m.title, emoji: mealEmoji(m.order) },
    }))
    .filter((m) => m.dishes.length > 0)
    .sort((a, b) => a.order - b.order);
}

export function sumDayDishMacros(day: DayMenu): {
  totalCalories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
} {
  let totalCalories = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let fiber = 0;

  for (const { dishes } of getMealsFromDay(day)) {
    for (const dish of dishes) {
      totalCalories += dish.calories || 0;
      protein += dish.protein || 0;
      fat += dish.fat || 0;
      carbs += dish.carbs || 0;
      fiber += dish.fiber || 0;
    }
  }

  return {
    totalCalories: Math.round(totalCalories),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    fiber: Math.round(fiber),
  };
}

export function computeDayTotals(day: DayMenu): {
  totalCalories: number;
  macros: Macros;
  fiber: number;
} {
  const sums = sumDayDishMacros(day);
  const fromDishes: Macros = {
    protein: sums.protein,
    fat: sums.fat,
    carbs: sums.carbs,
  };

  const dishMacroSum = fromDishes.protein + fromDishes.fat + fromDishes.carbs;
  const fallbackMacros = readDayMacros(day);
  const macros =
    dishMacroSum > 0
      ? fromDishes
      : fallbackMacros.protein + fallbackMacros.fat + fallbackMacros.carbs > 0
        ? fallbackMacros
        : fromDishes;

  const fiber = sums.fiber > 0 ? sums.fiber : Math.round(readNum(day.fiber));

  return {
    totalCalories: sums.totalCalories || Math.round(readNum(day.totalCalories)),
    macros,
    fiber,
  };
}

export function normalizeDayMenu(day: DayMenu | Record<string, unknown>): DayMenu {
  const base = day as Record<string, unknown>;
  const meals = dedupeMealIds(
    ensureMealsArray(day)
      .map((m) => normalizeMealSlot(m))
      .filter((m) => m.dishes.length > 0)
  );

  const draft: DayMenu = {
    totalCalories: readNum(base.totalCalories),
    macros: readDayMacros(day),
    fiber: readNum(base.fiber),
    meals,
    menu_justification: readMenuJustification(base),
  };

  const filled = fillMissingDishMacros(draft);
  const totals = computeDayTotals(filled);

  return cloneDayMenu({
    totalCalories: totals.totalCalories,
    macros: { ...totals.macros },
    fiber: totals.fiber,
    meals: filled.meals,
  });
}

export function formatDishMacros(dish: MenuDish): string {
  const p = Math.round(dish.protein || 0);
  const f = Math.round(dish.fat || 0);
  const c = Math.round(dish.carbs || 0);
  const fiber = Math.round(dish.fiber || 0);
  return `Б: ${p}г | Ж: ${f}г | В: ${c}г | Кл: ${fiber}г`;
}

function isValidDayMenu(day: unknown): day is DayMenu | Record<string, unknown> {
  if (!day || typeof day !== "object") return false;
  const d = day as Record<string, unknown>;
  if (!d.macros) return false;

  const meals = ensureMealsArray(d);
  if (meals.length === 0) return false;

  return meals.some((m) => m.dishes.length > 0 && m.dishes.every(isValidDish));
}

export function hasValidMenuDays(
  days: unknown
): days is Record<WeekDay, DayMenu> {
  if (!days || typeof days !== "object") return false;
  return WEEK_DAYS.some((d) => isValidDayMenu((days as Record<string, DayMenu>)[d]));
}

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

export function normalizeWeeklyMenu(menu: WeeklyMenu): WeeklyMenu {
  const days = { ...menu.days };
  for (const day of WEEK_DAYS) {
    if (days[day]) {
      days[day] = normalizeDayMenu(days[day]);
    }
  }
  return {
    ...menu,
    days,
    weekly_justification:
      typeof menu.weekly_justification === "string"
        ? menu.weekly_justification.trim()
        : undefined,
  };
}

export function tryNormalizeDayMenu(day: unknown): DayMenu | null {
  if (!isValidDayMenu(day)) return null;
  return normalizeDayMenu(day);
}

export function isGlobalMenuInstruction(instruction: string): boolean {
  const lower = instruction.toLowerCase();
  const mentionsDay = WEEK_DAYS.some((d) => lower.includes(d.toLowerCase()));
  if (mentionsDay) return false;
  return /меню|білк|бжв|калор|макро|вуглев|жир|раціон|тижден/i.test(lower);
}

function createEmptyDayMenu(): DayMenu {
  return {
    totalCalories: 0,
    macros: { protein: 0, fat: 0, carbs: 0 },
    fiber: 0,
    meals: [],
  };
}

export function createEmptyWeeklyMenu(): WeeklyMenu {
  const days = {} as Record<WeekDay, DayMenu>;
  for (const day of WEEK_DAYS) {
    days[day] = createEmptyDayMenu();
  }
  return {
    title: "Меню на тиждень",
    days,
    tips: [],
    approved: false,
  };
}
