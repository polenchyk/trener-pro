import type { DayMenu, WeekDay } from "./types";
import { tryNormalizeDayMenu } from "./menu-utils";

export type ConsultPhase = "consulting" | "ready";

export interface ConsultMenuResult {
  phase: ConsultPhase;
  explanation: string;
  dayMenu: DayMenu | null;
}

const FORM_MENU_PATTERNS = [
  /^формуй\s+меню/i,
  /^склади\s+меню/i,
  /^згенеруй\s+меню/i,
  /^готово[,.]?\s*формуй/i,
  /^можна\s+формувати/i,
];

/** Чи це явна команда сформувати меню */
export function isFormMenuCommand(text: string): boolean {
  const t = text.trim();
  return FORM_MENU_PATTERNS.some((re) => re.test(t));
}

const ADJUST_KEYWORDS =
  /заміни|зміни|зменши|збільш|прибери|додай|внеси|онови меню|весь тиждень|перекус|перенеси|прибери з|замість/i;

/** Чи схоже на команду коригування існуючого меню */
export function isAdjustMenuCommand(text: string): boolean {
  return ADJUST_KEYWORDS.test(text.trim());
}

/** Чи схоже на список продуктів (коми, переліки) */
export function looksLikeProductList(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (isFormMenuCommand(t) || isAdjustMenuCommand(t)) return false;
  const commaCount = (t.match(/,/g) ?? []).length;
  if (commaCount >= 2) return true;
  if (commaCount >= 1 && t.split(/\s+/).length >= 3) return true;
  if (/продукт|інгредієнт|є в наявності|маю:/i.test(t)) return true;
  const words = t.split(/[\s,;]+/).filter(Boolean);
  return words.length >= 3 && words.length <= 15 && !t.includes("?");
}

export function shouldStartConsultation(
  instruction: string,
  isConsulting: boolean,
  hasDayMenu: boolean
): boolean {
  if (isConsulting) return true;
  if (isFormMenuCommand(instruction)) return true;
  if (looksLikeProductList(instruction)) return true;
  if (!hasDayMenu) return true;
  if (hasDayMenu && isAdjustMenuCommand(instruction)) return false;
  return false;
}

export function parseConsultMenuResponse(
  parsed: unknown,
  activeDay: WeekDay
): ConsultMenuResult {
  if (!parsed || typeof parsed !== "object") {
    return {
      phase: "consulting",
      explanation: "Не вдалося розібрати відповідь AI. Спробуйте ще раз.",
      dayMenu: null,
    };
  }

  const obj = parsed as Record<string, unknown>;
  const explanation =
    typeof obj.explanation === "string" && obj.explanation.trim()
      ? obj.explanation.trim()
      : "Готово.";

  const phase: ConsultPhase =
    obj.phase === "ready" || obj.dayMenu ? "ready" : "consulting";

  let dayMenu: DayMenu | null = null;
  const rawMenu = obj.dayMenu ?? obj.updatedDay ?? obj[activeDay];
  if (rawMenu && typeof rawMenu === "object") {
    dayMenu = tryNormalizeDayMenu(rawMenu);
  }

  if (phase === "ready" && !dayMenu) {
    return { phase: "consulting", explanation, dayMenu: null };
  }

  return { phase: dayMenu ? "ready" : "consulting", explanation, dayMenu };
}
