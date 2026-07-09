export type Goal = "weight_loss" | "muscle_gain" | "maintenance" | "health";

export const GOAL_LABELS: Record<Goal, string> = {
  weight_loss: "Схуднення",
  muscle_gain: "Набір маси",
  maintenance: "Підтримка форми",
  health: "Здоров'я та енергія",
};

export const GOAL_EMOJI: Record<Goal, string> = {
  weight_loss: "🔻",
  muscle_gain: "💪",
  maintenance: "⚖️",
  health: "✨",
};

export interface Macros {
  /** Білки, г */
  protein: number;
  /** Жири, г */
  fat: number;
  /** Вуглеводи, г */
  carbs: number;
}

/** Готові фітнес-аватарки на вибір */
export const PRESET_AVATARS = ["💪", "🏃‍♀️", "🏋️‍♂️", "🧘‍♀️", "🚴", "🤸‍♀️"] as const;

export type Sex = "female" | "male";

export const SEX_LABELS: Record<Sex, string> = {
  female: "Жінка",
  male: "Чоловік",
};

/** Коефіцієнти активності для формули Міффліна-Сан Жеора */
export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Сидячий спосіб життя" },
  { value: 1.375, label: "Легка активність (1–3 тренування/тиж)" },
  { value: 1.55, label: "Середня активність (3–5 тренувань/тиж)" },
  { value: 1.725, label: "Важка активність (6–7 тренувань/тиж)" },
] as const;

/** Одне зважування */
export interface WeightEntry {
  /** ISO-дата, напр. "2026-07-09" */
  date: string;
  /** Вага, кг */
  value: number;
}

export interface Client {
  id: string;
  name: string;
  goal: Goal;
  /** Стать (потрібна для формули розрахунку калорій) */
  sex: Sex;
  /** Зріст, см */
  height: number;
  /** Вік, років */
  age: number;
  /** Коефіцієнт активності: 1.2 / 1.375 / 1.55 / 1.725 */
  activityLevel: number;
  /** Добова норма калорій (авторозрахунок, якщо не введена вручну) */
  calories: number;
  macros: Macros;
  /** Історія зважувань (від старих до нових) */
  weightHistory: WeightEntry[];
  /** Розклад тренувань: день тижня → опис (немає ключа = відпочинок) */
  weeklyWorkouts: Partial<Record<WeekDay, string>>;
  /** Емодзі з PRESET_AVATARS або фото у форматі data:image/... (base64) */
  avatar?: string;
  notes?: string;
  createdAt: number;
}

/** Остання відома вага клієнта */
export function latestWeight(client: Client): number | undefined {
  return client.weightHistory[client.weightHistory.length - 1]?.value;
}

/** Результат сканування тарілки по фото */
export interface ScanResult {
  title: string;
  ingredients: string[];
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export const WEEK_DAYS = [
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "П'ятниця",
  "Субота",
  "Неділя",
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

export const WEEK_DAY_SHORT: Record<WeekDay, string> = {
  Понеділок: "Пн",
  Вівторок: "Вт",
  Середа: "Ср",
  Четвер: "Чт",
  "П'ятниця": "Пт",
  Субота: "Сб",
  Неділя: "Нд",
};

export type MealKey = "breakfast" | "lunch" | "dinner";

export const MEAL_LABELS: Record<MealKey, { name: string; emoji: string }> = {
  breakfast: { name: "Сніданок", emoji: "🌅" },
  lunch: { name: "Обід", emoji: "☀️" },
  dinner: { name: "Вечеря", emoji: "🌙" },
};

/** Страва в межах прийому їжі */
export interface MenuDish {
  title: string;
  /** Наприклад: "150 г" або "1 склянка" */
  portion: string;
  calories: number;
}

/** Меню на один день тижня */
export interface DayMenu {
  totalCalories: number;
  macros: Macros;
  breakfast: MenuDish[];
  lunch: MenuDish[];
  dinner: MenuDish[];
}

/** Тижневе меню, яке повертає AI у суворому JSON */
export interface WeeklyMenu {
  title: string;
  days: Record<WeekDay, DayMenu>;
  tips: string[];
  /** Тренер натиснув «Затвердити та зберегти меню» */
  approved?: boolean;
}
