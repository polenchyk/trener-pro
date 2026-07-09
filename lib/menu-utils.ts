import { WEEK_DAYS, type DayMenu, type WeekDay, type WeeklyMenu } from "./types";

function isValidDayMenu(day: unknown): day is DayMenu {
  return (
    !!day &&
    typeof day === "object" &&
    Array.isArray((day as DayMenu).breakfast) &&
    Array.isArray((day as DayMenu).lunch) &&
    Array.isArray((day as DayMenu).dinner)
  );
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

  // updatedDays | updatedMenu.days | updatedMenu (якщо це об'єкт days)
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
        updatedDays[day] = dayMenu;
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

/** Чи інструкція стосується всього тижня (білки, БЖВ, меню загалом) */
export function isGlobalMenuInstruction(instruction: string): boolean {
  const lower = instruction.toLowerCase();
  const mentionsDay = WEEK_DAYS.some((d) => lower.includes(d.toLowerCase()));
  if (mentionsDay) return false;
  return /меню|білк|бжв|калор|макро|вуглев|жир|раціон|тижден/i.test(lower);
}
