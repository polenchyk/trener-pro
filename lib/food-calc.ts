/**
 * Розрахунковий рушій КБЖУ на основі food_database.json.
 *
 * Ідея (протокол точності): ШІ генерує ЛИШЕ список інгредієнтів + грамовку,
 * а всі цифри калорій та БЖВ рахує цей код зі стандартної бази. Тоді сума
 * завжди коректна і не залежить від «фантазій» моделі.
 *
 * Виключення овочів: продукти категорії «овочі/зелень» показуються в меню
 * (назва + грами), але їхні kcal/protein/fat/carbs/fiber НЕ додаються до
 * загального підсумку дня (протокол підрахунку раціону).
 */

import foodDatabaseRaw from "./food_database.json";
import type { DishIngredient, DishMicros, MenuDish } from "./types";

export interface FoodDbEntry {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

interface FoodDatabaseFile {
  _meta?: Record<string, string>;
  foods: Record<string, FoodDbEntry>;
}

const DB = (foodDatabaseRaw as FoodDatabaseFile).foods;

/** Усі валідні ключі продуктів (як у food_database.json) */
export const FOOD_DB_KEYS = Object.keys(DB);

/**
 * Ключі продуктів категорії «овочі/зелень».
 * Їхні КБЖУ показуються клієнту, але НЕ плюсуються до підсумку дня.
 * Крохмалисті (картопля) та бобові — рахуються, тому сюди не входять.
 */
export const VEGETABLE_KEYS = new Set<string>([
  "броколі",
  "шпинат",
  "помідор",
  "огірок",
  "морква",
  "цибуля ріпчаста",
  "перець солодкий",
  "капуста білоголова",
  "цвітна капуста",
  "кабачок",
  "баклажан",
  "гриби печериці",
  "буряк",
  "часник",
]);

/** Нормалізує ключ продукту для пошуку в базі */
function normKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Чи належить продукт до овочів/зелені (виключається з підсумку дня) */
export function isVegetableFood(name: string): boolean {
  return VEGETABLE_KEYS.has(normKey(name));
}

export interface IngredientNutrition {
  name: string;
  grams: number;
  /** Овоч/зелень — не рахується в підсумок дня */
  isVegetable: boolean;
  /** Чи знайдено продукт у базі */
  found: boolean;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * КБЖУ одного інгредієнта на задану вагу.
 * Назва приводиться до нижнього регістру перед пошуком у базі.
 */
export function getNutrition(name: string, grams: number): IngredientNutrition {
  const key = normKey(name);
  const item = DB[key];
  const isVegetable = VEGETABLE_KEYS.has(key);
  const safeGrams = Number.isFinite(grams) && grams > 0 ? grams : 0;

  if (!item) {
    return {
      name,
      grams: safeGrams,
      isVegetable,
      found: false,
      kcal: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: 0,
    };
  }

  const factor = safeGrams / 100;
  return {
    name,
    grams: safeGrams,
    isVegetable,
    found: true,
    kcal: Math.round(item.kcal * factor),
    protein: round1(item.protein * factor),
    fat: round1(item.fat * factor),
    carbs: round1(item.carbs * factor),
    fiber: round1(item.fiber * factor),
  };
}

export interface DishTotals {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

export interface DishBreakdown {
  /** Розкладка по кожному інгредієнту (включно з овочами) */
  items: IngredientNutrition[];
  /** Підсумок, що ЙДЕ в калораж дня (БЕЗ овочів) */
  counted: DishTotals;
  /** Повний підсумок (з овочами) — для довідки */
  full: DishTotals;
  /** Сумарна вага порахованих (не овочевих) інгредієнтів, г */
  countedGrams: number;
}

const EMPTY_TOTALS: DishTotals = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };

/**
 * Рахує розкладку страви з інгредієнтів.
 * Овочі/зелень включаються в `items` (для показу клієнту), але їхні значення
 * не входять у `counted` (підсумок для калоражу дня).
 */
export function calculateDishBreakdown(
  ingredients: { name: string; grams: number }[]
): DishBreakdown {
  const items: IngredientNutrition[] = [];
  const counted = { ...EMPTY_TOTALS };
  const full = { ...EMPTY_TOTALS };
  let countedGrams = 0;

  for (const { name, grams } of ingredients) {
    const n = getNutrition(name, grams);
    items.push(n);

    full.kcal += n.kcal;
    full.protein += n.protein;
    full.fat += n.fat;
    full.carbs += n.carbs;
    full.fiber += n.fiber;

    if (!n.isVegetable) {
      counted.kcal += n.kcal;
      counted.protein += n.protein;
      counted.fat += n.fat;
      counted.carbs += n.carbs;
      counted.fiber += n.fiber;
      countedGrams += n.grams;
    }
  }

  const finalize = (t: DishTotals): DishTotals => ({
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein),
    fat: Math.round(t.fat),
    carbs: Math.round(t.carbs),
    fiber: Math.round(t.fiber),
  });

  return {
    items,
    counted: finalize(counted),
    full: finalize(full),
    countedGrams: Math.round(countedGrams),
  };
}

/**
 * Головна функція розрахунку страви.
 * Повертає підсумок КБЖУ БЕЗ урахування овочів (як вимагає протокол).
 */
export function calculateDish(
  ingredients: { name: string; grams: number }[]
): DishTotals {
  return calculateDishBreakdown(ingredients).counted;
}

function readNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Розбирає сирий масив інгредієнтів з відповіді ШІ у DishIngredient[] */
export function normalizeIngredients(raw: unknown): DishIngredient[] {
  if (!Array.isArray(raw)) return [];
  const result: DishIngredient[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const name = String(o.name ?? o.назва ?? o.title ?? "").trim();
    if (!name) continue;
    const grams = readNum(o.grams ?? o.грам ?? o.вага ?? o.g);
    result.push({
      name,
      grams: Math.round(grams),
      isVegetable: isVegetableFood(name),
      found: Boolean(DB[normKey(name)]),
    });
  }
  return result;
}

const KJ_PER_KCAL = 4.184;

/** Будує обʼєкт мікронутрієнтів страви з порахованого підсумку */
function microsFromTotals(totals: DishTotals, grams: number): DishMicros {
  return {
    source: "food_database.json",
    basedOnGrams: grams,
    calories: totals.kcal,
    energyKj: Math.round(totals.kcal * KJ_PER_KCAL),
    protein: totals.protein,
    fat: totals.fat,
    carbs: totals.carbs,
    fiber: totals.fiber,
  };
}

/**
 * Перераховує КБЖУ страви з її інгредієнтів (овочі не входять у підсумок).
 * Якщо інгредієнтів немає або стоїть ручний перезапис — повертає без змін.
 */
export function recalcDishFromIngredients(dish: MenuDish): MenuDish {
  if (dish.manualOverride) return dish;
  if (!dish.ingredients || dish.ingredients.length === 0) return dish;

  const breakdown = calculateDishBreakdown(dish.ingredients);
  const ingredients = breakdown.items.map((it) => ({
    name: it.name,
    grams: it.grams,
    isVegetable: it.isVegetable,
    found: it.found,
  }));

  const { counted, countedGrams } = breakdown;

  return {
    ...dish,
    ingredients,
    calories: counted.kcal,
    protein: counted.protein,
    fat: counted.fat,
    carbs: counted.carbs,
    fiber: counted.fiber,
    micros: countedGrams > 0 ? microsFromTotals(counted, countedGrams) : dish.micros,
  };
}

/** Рядок порції для страви на основі її інгредієнтів (для UI) */
export function ingredientsToPortion(ingredients: DishIngredient[]): string {
  return ingredients
    .map((i) => `${i.name} ${i.grams} г`)
    .join(", ");
}

/**
 * Правило для системного промпту ШІ: генерувати ЛИШЕ інгредієнти + грами,
 * не вигадувати цифри КБЖУ. Розрахунок робить застосунок.
 */
export const INGREDIENT_ENGINE_RULE = `РОЗРАХУНКОВИЙ РУШІЙ (СУВОРО, НАЙВИЩИЙ ПРІОРИТЕТ):
Ти більше НЕ маєш права самостійно вигадувати чи писати цифри калорій та БЖВ у тексті. Твоє завдання — згенерувати меню строго у форматі JSON, де для КОЖНОЇ страви ти вказуєш лише поле "ingredients" — список інгредієнтів. Для кожного інгредієнта вкажи:
  • "name" — назва, що СУВОРО збігається з ключем із food_database.json (напр.: "вівсянка (суха)", "куряче філе (сире)", "мигдаль");
  • "grams" — вага в грамах (число).

КБЖУ (calories, protein, fat, carbs, fiber) рахує САМ застосунок з бази — НЕ пиши ці числа сам, вони будуть проігноровані/перезаписані.

ВАЖЛИВО:
- Використовуй ЛИШЕ назви-ключі з переліку нижче. Якщо потрібного продукту немає — обери найближчий доступний ключ.
- Овочі/зелень (броколі, шпинат, помідор, огірок, морква тощо) можна додавати для об'єму й клітковини — вони показуються клієнту, але НЕ входять у калораж дня (це закладено в рушій).
- Грамовки став у СИРОМУ/СУХОМУ вигляді (крупи, м'ясо, риба — до варіння).

ДОСТУПНІ КЛЮЧІ ПРОДУКТІВ (food_database.json):
${FOOD_DB_KEYS.map((k) => `"${k}"`).join(", ")}`;
