import type { DishMicros, MenuDish } from "./types";
import nutritionBaseRaw from "./nutrition_base.json";

export interface NutritionBaseProduct {
  id: string;
  name: string;
  aliases: string[];
  /** Вага 1 штуки в грамах (для яєць, бананів тощо) */
  gramsPerPiece?: number;
  /** Значення на 100 г продукту */
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar?: number;
  saturatedFat?: number;
  transFat?: number;
  monoFat?: number;
  polyFat?: number;
  /** Холестерин, мг */
  cholesterol?: number;
  /** Сіль, г */
  salt?: number;
  /** Кальцій, мг */
  calcium?: number;
}

interface NutritionBaseFile {
  source: string;
  per: number;
  unit: string;
  products: NutritionBaseProduct[];
}

const BASE = nutritionBaseRaw as NutritionBaseFile;

export const NUTRITION_BASE_SOURCE = BASE.source;
export const NUTRITION_BASE_PRODUCTS = BASE.products;

const KJ_PER_KCAL = 4.184;

/** Нормалізує рядок для пошуку: нижній регістр, без зайвих символів */
function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Маркери складеної страви — для таких не застосовуємо жорсткий перерахунок */
const COMPOSITE_MARKERS = [
  ",",
  " з ",
  " із ",
  " зі ",
  " та ",
  " і ",
  " + ",
  "+",
  "/",
  " на ",
  " під ",
];

export function isCompositeTitle(title: string): boolean {
  const t = norm(title);
  return COMPOSITE_MARKERS.some((m) => t.includes(m));
}

/** Знаходить продукт бази за назвою страви (лише впевнений моно-матч) */
export function findBaseProduct(title: string): NutritionBaseProduct | null {
  const t = norm(title);
  if (!t) return null;

  // Складені страви не чіпаємо — надто неоднозначно
  if (isCompositeTitle(title)) return null;

  let best: { product: NutritionBaseProduct; aliasLen: number } | null = null;
  for (const product of BASE.products) {
    for (const alias of product.aliases) {
      const a = norm(alias);
      if (!a) continue;
      // Точний збіг або назва починається/містить alias як окреме слово
      const matches =
        t === a ||
        t.startsWith(a + " ") ||
        t.endsWith(" " + a) ||
        t.includes(" " + a + " ") ||
        t.replace(/\d+\s*(г|мл|шт|штук|штуки)?/g, "").trim() === a;
      if (matches) {
        if (!best || a.length > best.aliasLen) {
          best = { product, aliasLen: a.length };
        }
      }
    }
  }
  return best?.product ?? null;
}

/** Витягує вагу страви в грамах з рядка порції */
export function parsePortionGrams(
  portion: string,
  product?: NutritionBaseProduct | null
): number {
  const p = norm(portion);
  if (!p) return 0;

  const numMatch = p.match(/(\d+[.,]?\d*)/);
  if (!numMatch) return 0;
  const num = Number(numMatch[1].replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return 0;

  const isPiece = /\bшт\b|\bштук|\bяйц|\bбанан/.test(p);
  const isMl = /\bмл\b|\bмілілітр/.test(p);
  const isGram = /\bг\b|\bгр\b|\bграм/.test(p);

  if (isGram) return num;
  if (isMl) return num; // щільність ~1 г/мл для рідин у побуті
  if (isPiece && product?.gramsPerPiece) return num * product.gramsPerPiece;
  // Просто число без одиниць — вважаємо грамами
  return num;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Рахує мікронутрієнти для заданої ваги продукту */
export function computeMicrosFromBase(
  product: NutritionBaseProduct,
  grams: number
): DishMicros {
  const k = grams / 100;
  const scale = (v: number | undefined) =>
    v == null ? undefined : round2(v * k);

  const calories = Math.round(product.calories * k);
  return {
    source: NUTRITION_BASE_SOURCE,
    basedOnGrams: Math.round(grams),
    calories,
    energyKj: Math.round(calories * KJ_PER_KCAL),
    protein: round1(product.protein * k),
    fat: round1(product.fat * k),
    carbs: round1(product.carbs * k),
    fiber: round1(product.fiber * k),
    sugar: scale(product.sugar),
    saturatedFat: scale(product.saturatedFat),
    transFat: scale(product.transFat),
    monoFat: scale(product.monoFat),
    polyFat: scale(product.polyFat),
    cholesterol: scale(product.cholesterol),
    salt: scale(product.salt),
    calcium: scale(product.calcium),
  };
}

/**
 * Стандартизує страву за жорсткою базою:
 * - якщо це моно-продукт з бази і не було ручного перезапису —
 *   перераховує БЖУ та мікронутрієнти строго за коефіцієнтами.
 */
export function enrichDishFromBase(dish: MenuDish): MenuDish {
  if (dish.manualOverride) return dish;

  const product = findBaseProduct(dish.title);
  if (!product) return dish;

  const grams = parsePortionGrams(dish.portion, product);
  if (grams <= 0) return dish;

  const micros = computeMicrosFromBase(product, grams);

  return {
    ...dish,
    calories: micros.calories,
    protein: Math.round(micros.protein),
    fat: Math.round(micros.fat),
    carbs: Math.round(micros.carbs),
    fiber: Math.round(micros.fiber),
    baseProductId: product.id,
    micros,
  };
}

/** Правило для системного промпту ШІ */
export const NUTRITION_BASE_RULE = `ЖОРСТКА БАЗА БЖУ (український стандарт «Таблиця калорійності»):
- Для СТАНДАРТНИХ моно-продуктів (яйця, крупи, філе, сир, банан, олія, горіхи тощо) вкажи ТОЧНУ назву українською та ВАГУ у грамах (або штуках для яєць/бананів). Застосунок САМ підставить еталонні БЖУ з жорсткої бази — не вигадуй власні цифри для таких продуктів.
- Приклад еталону: варене куряче яйце на 100 г = 143 ккал, білки 13 г, жири 10.61 г, вуглеводи 1.12 г. Тобто 1 яйце (~50 г) ≈ 72 ккал, ~6.5 г білка.
- Для складених страв (з кількох інгредієнтів) рахуй суму БЖУ інгредієнтів за базою.
- Не давай «рандомні» значення для однакових продуктів — вони мають бути стабільними між днями.`;
