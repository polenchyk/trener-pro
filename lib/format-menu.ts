import {
  Client,
  DayMenu,
  GOAL_EMOJI,
  GOAL_LABELS,
  MEAL_LABELS,
  MealKey,
  WEEK_DAYS,
  WeekDay,
  WeeklyMenu,
} from "./types";

const DIVIDER = "━━━━━━━━━━━━━━━━";
const SIGNATURE = "З турботою про твою форму, твій тренер! 💪🏼";

const MEAL_KEYS: MealKey[] = ["breakfast", "lunch", "dinner"];

function dayLines(day: WeekDay, menu: DayMenu): string[] {
  const lines: string[] = [];
  lines.push(`📅 ${day.toUpperCase()} — ~${menu.totalCalories} ккал`);
  lines.push(
    `🥩 ${menu.macros.protein} г  |  🥑 ${menu.macros.fat} г  |  🍞 ${menu.macros.carbs} г`
  );
  for (const key of MEAL_KEYS) {
    const { name, emoji } = MEAL_LABELS[key];
    lines.push("");
    lines.push(`${emoji} ${name}:`);
    for (const dish of menu[key]) {
      lines.push(`• ${dish.title} — ${dish.portion} (${dish.calories} ккал)`);
    }
  }
  return lines;
}

function header(client: Client, title: string): string[] {
  return [
    `🍽 ${title}`,
    `👤 Клієнт: ${client.name}`,
    `${GOAL_EMOJI[client.goal]} Ціль: ${GOAL_LABELS[client.goal]} · ${client.calories} ккал/день`,
  ];
}

/** Весь тиждень одним структурованим текстом (Пн–Нд) */
export function formatWeekForMessenger(client: Client, menu: WeeklyMenu): string {
  const lines: string[] = header(client, menu.title || "МЕНЮ НА ТИЖДЕНЬ");

  for (const day of WEEK_DAYS) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push(...dayLines(day, menu.days[day]));
  }

  if (menu.tips.length > 0) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push("💡 ПОРАДИ НА ТИЖДЕНЬ:");
    for (const tip of menu.tips) {
      lines.push(`✅ ${tip}`);
    }
  }

  lines.push("");
  lines.push(SIGNATURE);
  return lines.join("\n");
}

/** Лише один обраний день */
export function formatDayForMessenger(
  client: Client,
  menu: WeeklyMenu,
  day: WeekDay
): string {
  const lines: string[] = header(client, `МЕНЮ НА ${day.toUpperCase()}`);
  lines.push("");
  lines.push(DIVIDER);
  lines.push(...dayLines(day, menu.days[day]));
  lines.push("");
  lines.push(SIGNATURE);
  return lines.join("\n");
}
