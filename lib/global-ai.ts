import { GOAL_LABELS, latestWeight, WEEK_DAYS, type Client, type WeekDay } from "./types";
import { normalizeWeekDay } from "./workout-utils";

export type GlobalAiActionType = "add_weight" | "move_workout";

export interface GlobalAiAddWeightAction {
  type: "add_weight";
  clientId: string;
  value: number;
  date?: string;
}

export interface GlobalAiMoveWorkoutAction {
  type: "move_workout";
  clientId: string;
  fromDay: WeekDay;
  toDay: WeekDay;
}

export type GlobalAiAction = GlobalAiAddWeightAction | GlobalAiMoveWorkoutAction;

export interface GlobalAiResponse {
  answer: string;
  actions: GlobalAiAction[];
}

export function parseGlobalAiResponse(parsed: unknown): GlobalAiResponse {
  if (!parsed || typeof parsed !== "object") {
    return { answer: "Не вдалося розібрати відповідь AI.", actions: [] };
  }

  const obj = parsed as Record<string, unknown>;
  const answer =
    typeof obj.answer === "string" && obj.answer.trim()
      ? obj.answer.trim()
      : "Готово.";

  const actions: GlobalAiAction[] = [];
  if (Array.isArray(obj.actions)) {
    for (const raw of obj.actions) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as Record<string, unknown>;
      const clientId = typeof a.clientId === "string" ? a.clientId : "";
      if (!clientId) continue;

      if (a.type === "add_weight" && typeof a.value === "number" && a.value > 0) {
        actions.push({
          type: "add_weight",
          clientId,
          value: a.value,
          date: typeof a.date === "string" ? a.date : undefined,
        });
      }

      if (a.type === "move_workout" && typeof a.fromDay === "string" && typeof a.toDay === "string") {
        const fromDay = normalizeWeekDay(a.fromDay);
        const toDay = normalizeWeekDay(a.toDay);
        if (fromDay && toDay) {
          actions.push({
            type: "move_workout",
            clientId,
            fromDay,
            toDay,
          });
        }
      }
    }
  }

  return { answer, actions };
}

/** Сьогоднішній та завтрашній день тижня (Понеділок–Неділя) */
export function getTodayContext(now = new Date()) {
  const jsDay = now.getDay();
  const todayIndex = jsDay === 0 ? 6 : jsDay - 1;
  const tomorrowIndex = (todayIndex + 1) % 7;
  return {
    todayDate: now.toISOString().slice(0, 10),
    todayWeekDay: WEEK_DAYS[todayIndex],
    tomorrowWeekDay: WEEK_DAYS[tomorrowIndex],
  };
}

/** Повний розклад тренувань на 7 днів для промпту AI */
function serializeWeeklyWorkouts(workouts: Client["weeklyWorkouts"]): Record<WeekDay, string> {
  return Object.fromEntries(
    WEEK_DAYS.map((d) => [d, workouts[d]?.trim() ?? ""])
  ) as Record<WeekDay, string>;
}

/** Скорочений список клієнтів для промпту AI */
export function serializeClientsForAi(clients: Client[]) {
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    goal: GOAL_LABELS[c.goal],
    calories: c.calories,
    latestWeight: latestWeight(c) ?? null,
    weightHistory: c.weightHistory.slice(-5),
    weeklyWorkouts: serializeWeeklyWorkouts(c.weeklyWorkouts ?? {}),
    notes: c.notes ?? null,
  }));
}
