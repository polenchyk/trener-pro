import {
  Client,
  DayMenu,
  GOAL_EMOJI,
  GOAL_LABELS,
  WEEK_DAYS,
  WeekDay,
  WeeklyMenu,
} from "./types";
import { computeDayTotals, getMealsFromDay, normalizeDayMenu } from "./menu-utils";

const DIVIDER = "━━━━━━━━━━━━━━━━";
const SIGNATURE = "З турботою про твою форму, твій тренер! 💪🏼";

function dayLines(day: WeekDay, menu: DayMenu): string[] {
  const normalized = normalizeDayMenu(menu);
  const totals = computeDayTotals(normalized);
  const lines: string[] = [];
  lines.push(`📅 ${day.toUpperCase()} — ~${totals.totalCalories} ккал`);
  lines.push(
    `🥩 ${totals.macros.protein} г  |  🥑 ${totals.macros.fat} г  |  🍞 ${totals.macros.carbs} г`
  );

  for (const meal of getMealsFromDay(normalized)) {
    lines.push("");
    lines.push(`${meal.label.emoji} ${meal.label.name}:`);
    for (const dish of meal.dishes) {
      const p = Math.round(dish.protein || 0);
      const f = Math.round(dish.fat || 0);
      const c = Math.round(dish.carbs || 0);
      lines.push(
        `• ${dish.title} — ${dish.portion} (${dish.calories} ккал, Б: ${p}г | Ж: ${f}г | В: ${c}г)`
      );
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
