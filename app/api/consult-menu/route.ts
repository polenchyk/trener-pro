import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { CONSULT_MENU_SYSTEM_PROMPT } from "@/lib/prompt";
import { isFormMenuCommand, parseConsultMenuResponse } from "@/lib/consult-menu";
import type { DayMenu, WeekDay } from "@/lib/types";
import {
  formatMealsForContext,
  hasDayMenuContent,
  suggestMealOrderFromInstruction,
} from "@/lib/menu-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ConsultMenuBody {
  client: {
    name: string;
    goal: string;
    weight?: number;
    macroNormsPerKg: { protein: number; fat: number; carbs: number };
    targetMacros: { protein: number; fat: number; carbs: number };
    targetFiber?: number;
    calories?: number;
    notes?: string;
  };
  activeDay: WeekDay;
  workoutForDay?: string;
  instruction: string;
  messages?: ChatMessage[];
  forceForm?: boolean;
  /** Поточне меню дня (для коригування) */
  currentDayMenu?: DayMenu | null;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY не налаштований. Додайте ключ у файл .env.local у корені проекту.",
      },
      { status: 500 }
    );
  }

  let body: ConsultMenuBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 });
  }

  if (!body.client?.name || !body.instruction?.trim() || !body.activeDay) {
    return NextResponse.json(
      { error: "Потрібні дані клієнта, день та інструкція." },
      { status: 400 }
    );
  }

  const c = body.client;
  const instruction = body.instruction.trim();
  const history = (body.messages ?? []).slice(-8);
  const forceForm = body.forceForm || isFormMenuCommand(instruction);
  const norms = c.macroNormsPerKg;
  const target = c.targetMacros;
  const currentDayMenu = body.currentDayMenu ?? null;
  const hasCurrentMenu = hasDayMenuContent(currentDayMenu);
  const suggestedOrder = hasCurrentMenu && currentDayMenu
    ? suggestMealOrderFromInstruction(currentDayMenu, instruction)
    : null;

  const contextBlock = [
    `Клієнт: ${c.name}`,
    `Ціль: ${c.goal}`,
    c.weight ? `Вага: ${c.weight} кг` : "Вага: не вказана",
    `Норми БЖВ (г/кг): білок ${norms.protein}, жири ${norms.fat}, вуглеводи ${norms.carbs}`,
    `Розраховані цільові БЖВ на день: білок ${target.protein} г, жири ${target.fat} г, вуглеводи ${target.carbs} г`,
    c.targetFiber ? `Цільова клітковина: ${c.targetFiber} г/день` : "",
    c.calories ? `Орієнтир калорій: ${c.calories} ккал` : "",
    c.notes ? `Особливості: ${c.notes}` : "",
    `День тижня: ${body.activeDay}`,
    body.workoutForDay?.trim()
      ? `Тренування цього дня: ${body.workoutForDay.trim()}`
      : "Тренування цього дня: відпочинок / не заплановано",
    forceForm
      ? `ПІДКАЗКА: тренер дав команду сформувати меню — поверни phase "ready" з dayMenu.`
      : `ПІДКАЗКА: якщо ще не зібрано достатньо відповідей — лишайся в phase "consulting" з питаннями.`,
    c.weight
      ? `Цільові БЖВ для клієнта (Вага ${c.weight} кг): Б-${target.protein}г, Ж-${target.fat}г, В-${target.carbs}г, Кл-${c.targetFiber ?? 25}г`
      : "",
    hasCurrentMenu
      ? `Поточне меню на ${body.activeDay} (JSON): ${JSON.stringify(currentDayMenu)}`
      : "",
    hasCurrentMenu && currentDayMenu
      ? `Таймлайн прийомів їжі: ${formatMealsForContext(currentDayMenu)}`
      : "",
    suggestedOrder !== null
      ? `Рекомендований order для нового/зміненого прийому їжі: ${suggestedOrder}`
      : "",
    hasCurrentMenu && !forceForm
      ? `ПІДКАЗКА: тренер коригує існуюче меню — поверни phase "ready" з оновленим dayMenu (повний об'єкт дня, усі ключі прийомів їжі).`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: CONSULT_MENU_SYSTEM_PROMPT },
    { role: "user", content: contextBlock },
  ];

  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      openaiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  if (
    history.length === 0 ||
    history[history.length - 1]?.content !== instruction ||
    history[history.length - 1]?.role !== "user"
  ) {
    openaiMessages.push({ role: "user", content: instruction });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.45,
      max_tokens: 4000,
      messages: openaiMessages,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "AI повернув порожню відповідь. Спробуйте ще раз." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw);
    const result = parseConsultMenuResponse(parsed, body.activeDay);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Невідома помилка під час звернення до OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
