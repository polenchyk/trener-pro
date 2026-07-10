import { WEEK_DAYS, type WeekDay } from "./types";

const WEEK_DAY_ALIASES: Record<string, WeekDay> = {
  пн: "Понеділок",
  понеділок: "Понеділок",
  mon: "Понеділок",
  monday: "Понеділок",
  вт: "Вівторок",
  вівторок: "Вівторок",
  tue: "Вівторок",
  tuesday: "Вівторок",
  ср: "Середа",
  середа: "Середа",
  wed: "Середа",
  wednesday: "Середа",
  чт: "Четвер",
  четвер: "Четвер",
  thu: "Четвер",
  thursday: "Четвер",
  "пт": "П'ятниця",
  "п'ятниця": "П'ятниця",
  fri: "П'ятниця",
  friday: "П'ятниця",
  сб: "Субота",
  субота: "Субота",
  sat: "Субота",
  saturday: "Субота",
  нд: "Неділя",
  неділя: "Неділя",
  sun: "Неділя",
  sunday: "Неділя",
};

export function isWeekDay(value: string): value is WeekDay {
  return (WEEK_DAYS as readonly string[]).includes(value);
}

/** Нормалізує назву дня (Пн, понеділок → Понеділок) */
export function normalizeWeekDay(value: string): WeekDay | null {
  const trimmed = value.trim();
  if (isWeekDay(trimmed)) return trimmed;
  return WEEK_DAY_ALIASES[trimmed.toLowerCase()] ?? null;
}

export interface AdjustWorkoutResult {
  updatedWorkouts: Partial<Record<WeekDay, string>> | null;
  explanation?: string;
}

/** Нормалізує JSON-відповідь AI для тренувань */
export function parseAdjustWorkoutResponse(parsed: unknown): AdjustWorkoutResult {
  if (!parsed || typeof parsed !== "object") {
    return { updatedWorkouts: null };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.updatedWorkouts === null) {
    const explanation =
      typeof obj.explanation === "string" ? obj.explanation.trim() : undefined;
    return { updatedWorkouts: null, explanation };
  }

  let raw = obj.updatedWorkouts;
  if (!raw && obj.workouts && typeof obj.workouts === "object") {
    raw = obj.workouts;
  }

  const updatedWorkouts: Partial<Record<WeekDay, string>> = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const day = normalizeWeekDay(key);
      if (!day) continue;
      updatedWorkouts[day] = typeof value === "string" ? value : "";
    }
  }

  const explanation =
    typeof obj.explanation === "string" ? obj.explanation.trim() : undefined;

  return {
    updatedWorkouts: Object.keys(updatedWorkouts).length > 0 ? updatedWorkouts : null,
    explanation,
  };
}

/** Повний розклад на 7 днів для промпту AI */
export function serializeWorkoutsForAi(
  workouts: Partial<Record<WeekDay, string>>
): Record<WeekDay, string> {
  return Object.fromEntries(
    WEEK_DAYS.map((d) => [d, workouts[d]?.trim() ?? ""])
  ) as Record<WeekDay, string>;
}
