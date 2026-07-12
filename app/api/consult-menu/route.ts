import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildClientContextBlock } from "@/lib/coach-prompt";
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
    age?: number;
    height?: number;
    activityLevel?: number;
    macroNormsPerKg: { protein: number; fat: number; carbs: number };
    targetMacros: { protein: number; fat: number; carbs: number };
    targetFiber?: number;
    calories?: number;
    notes?: string;
    sex?: string;
    weeklyWorkouts?: Partial<Record<WeekDay, string>>;
    weightHistory?: { date: string; value: number }[];
  };
  activeDay: WeekDay;
  workoutForDay?: string;
  instruction: string;
  messages?: ChatMessage[];
  forceForm?: boolean;
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
  const currentDayMenu = body.currentDayMenu ?? null;
  const hasCurrentMenu = hasDayMenuContent(currentDayMenu);
  const suggestedOrder =
    hasCurrentMenu && currentDayMenu
      ? suggestMealOrderFromInstruction(currentDayMenu, instruction)
      : null;

  const clientBlock = buildClientContextBlock({
    name: c.name,
    goal: c.goal,
    sex: c.sex,
    age: c.age,
    height: c.height,
    weight: c.weight,
    activityLevel: c.activityLevel,
    calories: c.calories,
    macroNormsPerKg: c.macroNormsPerKg,
    targetMacros: c.targetMacros,
    targetFiber: c.targetFiber,
    notes: c.notes,
    weeklyWorkouts: c.weeklyWorkouts,
    weightHistory: c.weightHistory,
    activeDay: body.activeDay,
    workoutForDay: body.workoutForDay,
  });

  const menuHints = [
    forceForm
      ? `ПІДКАЗКА: тренер дав команду сформувати меню — phase "ready" з dayMenu.`
      : "",
    hasCurrentMenu && !forceForm
      ? `ПІДКАЗКА: є меню на ${body.activeDay} — змінюй лише якщо інтент = корекція їжі (phase "ready"). Інакше phase "chat".`
      : "",
    hasCurrentMenu && currentDayMenu
      ? `Поточне меню на ${body.activeDay} (JSON): ${JSON.stringify(currentDayMenu)}`
      : "",
    hasCurrentMenu && currentDayMenu
      ? `Таймлайн прийомів їжі: ${formatMealsForContext(currentDayMenu)}`
      : "",
    suggestedOrder !== null
      ? `Рекомендований order для нового/зміненого прийому їжі: ${suggestedOrder}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const contextBlock = [clientBlock, menuHints].filter(Boolean).join("\n\n");

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
      max_tokens: 8000,
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
