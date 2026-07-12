import { Client, DayMenu, GOAL_EMOJI, GOAL_LABELS, WeekDay } from "./types";
import {
  formatDishMacros,
  getMealsFromDay,
  normalizeDayMenu,
  sumDayDishMacros,
} from "./menu-utils";

const DIVIDER = "━━━━━━━━━━━━━━━━";
const SIGNATURE = "З турботою про твою форму, твій тренер! 💪🏼";

function dayLines(day: WeekDay, menu: DayMenu): string[] {
  const normalized = normalizeDayMenu(menu);
  const meals = getMealsFromDay(normalized);

  const dishSums = sumDayDishMacros(normalized);
  const protein = Math.round(dishSums.protein || normalized.macros?.protein || 0);
  const fat = Math.round(dishSums.fat || normalized.macros?.fat || 0);
  const carbs = Math.round(dishSums.carbs || normalized.macros?.carbs || 0);
  const fiber = Math.round(dishSums.fiber || normalized.fiber || 0);
  const totalCalories = Math.round(dishSums.totalCalories || normalized.totalCalories || 0);

  const lines: string[] = [];
  lines.push(`📅 ${day.toUpperCase()} — ~${totalCalories} ккал`);
  lines.push(
    `🥩 ${protein} г  |  🥑 ${fat} г  |  🍞 ${carbs} г  |  🌾 ${fiber} г клітковини`
  );

  for (const meal of meals) {
    lines.push("");
    lines.push(`${meal.label.emoji} ${meal.label.name}:`);
    for (const dish of meal.dishes) {
      lines.push(
        `• ${dish.title} — ${dish.portion} (${dish.calories} ккал, ${formatDishMacros(dish)})`
      );
    }
  }

  const justification = normalized.menu_justification?.trim();
  if (justification) {
    lines.push("");
    lines.push("🧑‍🏫 Обґрунтування раціону (Логіка тренера)");
    lines.push(justification);
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

/** Меню одного дня для месенджерів */
export function formatDayMenuForMessenger(
  client: Client,
  day: WeekDay,
  dayMenu: DayMenu
): string {
  const lines: string[] = header(client, `МЕНЮ НА ${day.toUpperCase()}`);
  lines.push("");
  lines.push(DIVIDER);
  lines.push(...dayLines(day, dayMenu));
  lines.push("");
  lines.push(SIGNATURE);
  return lines.join("\n");
}

/** @deprecated Використовуйте formatDayMenuForMessenger */
export function formatDayForMessenger(
  client: Client,
  menu: { days: Record<WeekDay, DayMenu> },
  day: WeekDay
): string {
  return formatDayMenuForMessenger(client, day, menu.days[day]);
}
